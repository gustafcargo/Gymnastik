/**
 * GameGymnast3D – spelbar gymnast som rör sig fritt i salen.
 * Kroppen renderas via den delade <GymnastBody> (ansikte + tåspets mot −Z).
 */
import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Station } from "../../types";
import { getEquipmentById } from "../../catalog/equipment";
import { exercisesForKind, allExercises, type Exercise } from "../../catalog/exercises";
import { BUILT_IN_EXERCISES } from "./Gymnast3D";
import { useCustomExercisesStore } from "../../store/useCustomExercisesStore";
import {
  GymnastBody,
  H_TORSO, H_UPPER, H_LOWER, H_THIGH, H_SHIN, HANG_DIST,
  type BodyRefs,
} from "./GymnastBody";
import { type Pose, type KF, ZERO, evalKF, evalExercise, pend as _pend } from "../../types/pose";

const P = Math.PI;

// Uppslag som respekterar användarens overrides från useCustomExercisesStore.
function lookupExercise(id: string) {
  const custom = useCustomExercisesStore.getState().customDefs[id];
  return custom ?? BUILT_IN_EXERCISES[id];
}

// Gångcykel – 4 nyckelbilder, 0.6 s/cykel
// Gångcykel i fri rörelse (rootRotY=0, ansikte mot −Z).
// Positiv hipX → ben svänger framåt (mot −Z). Negativt knäX → underben hänger
// bakåt relativt låret = naturlig knäböjning i framsvingen.
const WALK_KFS: KF[] = [
  { t:0.0,  pose:{...ZERO,lHipX:-P*0.18,rHipX:P*0.22,rKnX:-P*0.12,lShX:P*0.12,rShX:-P*0.10,lShZ:-P*0.08,rShZ:P*0.08,spineZ:0.02 } },
  { t:0.15, pose:{...ZERO,lHipX:P*0.04, rHipX:-P*0.08,rKnX:-P*0.20,spineZ:-0.01,rootY:0.015 } },
  { t:0.30, pose:{...ZERO,rHipX:-P*0.18,lHipX:P*0.22,lKnX:-P*0.12,rShX:P*0.12,lShX:-P*0.10,lShZ:-P*0.08,rShZ:P*0.08,spineZ:-0.02 } },
  { t:0.45, pose:{...ZERO,rHipX:P*0.04, lHipX:-P*0.08,lKnX:-P*0.20,spineZ:0.01,rootY:0.015 } },
  { t:0.60, pose:{...ZERO,lHipX:-P*0.18,rHipX:P*0.22,rKnX:-P*0.12,lShX:P*0.12,rShX:-P*0.10,lShZ:-P*0.08,rShZ:P*0.08,spineZ:0.02 } },
];

// Idle (subtil andning)
const IDLE_KFS: KF[] = [
  { t:0,   pose:{...ZERO,lShZ:-0.05,rShZ:0.05} },
  { t:2.0, pose:{...ZERO,spineX:P*0.015,rootY:0.008,lShZ:0.04,rShZ:-0.04} },
  { t:4.0, pose:{...ZERO,lShZ:-0.05,rShZ:0.05} },
];

// Re-export bakåtkompatibel pend (shim mot delad helper).
const pend = _pend;

// ─── Huvud-komponent ──────────────────────────────────────────────────────────
export type MountedExerciseInfo = {
  exercises: Exercise[];
  exerciseId: string;
  onChange: (id: string) => void;
};

type Props = {
  station: Station;
  hallW: number;
  hallH: number;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  cameraOrbitRef: React.MutableRefObject<{ yaw: number; pitch: number; distScale: number }>;
  onNearEquipment: (name: string | null) => void;
  onMountedExercises: (info: MountedExerciseInfo | null) => void;
  onFreeCamChange: (on: boolean) => void;
  onExit: () => void;
  color?: string;
};

const TURN_SPEED = 2.5;   // rad/s
const PROX       = 1.8;   // m, monteringsradie
const CAM_DIST   = 5.5;   // m bakom gymnasten
const CAM_HEIGHT = 2.2;   // m ovanför höfterna

export function GameGymnast3D({
  station, hallW, hallH, joystickRef, mountTriggerRef, speedRef, cameraResetRef,
  cameraOrbitRef,
  onNearEquipment, onMountedExercises, onFreeCamChange, onExit, color = "#C2185B",
}: Props) {
  const SKIN = "#E8C99A";
  const HAIR = "#2d1a08";

  const { camera } = useThree();

  // Position & orientering
  const pos    = useRef({ x: hallW / 2, z: hallH / 2 });
  const rotY   = useRef(0);
  const camYaw = useRef(0);  // kamerans yaw – lerpar mot rotY med fördröjning
  const mounted = useRef<null | { eqId: string; exerciseId: string; baseY: number }>(null);
  const nearEq  = useRef<null | { id: string; name: string }>(null);
  // One-shot floor-trick (hjulning/kullerbytta/etc.) – spelas en gång när
  // användaren trycker trick-knappen i fritt läge.
  const oneShot = useRef<null | {
    exerciseId: string;
    startT: number;
    startX: number;
    startZ: number;
    startRotY: number;
  }>(null);
  const onMountedExercisesRef = useRef(onMountedExercises);
  onMountedExercisesRef.current = onMountedExercises;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const onFreeCamChangeRef = useRef(onFreeCamChange);
  onFreeCamChangeRef.current = onFreeCamChange;

  // Kamera-mål
  const camPos  = useRef(new THREE.Vector3());
  const camLook = useRef(new THREE.Vector3());

  // Tangenter + edge-triggers
  const keys = useRef(new Set<string>());
  const spaceDown = useRef(false);
  const eCycleRef = useRef(false);
  const freeCamRef = useRef(false);

  const rootRef  = useRef<THREE.Group>(null);
  const bodyRefs: BodyRefs = {
    spineRef: useRef<THREE.Group>(null),
    headRef:  useRef<THREE.Group>(null),
    lShRef:   useRef<THREE.Group>(null),
    lElRef:   useRef<THREE.Group>(null),
    rShRef:   useRef<THREE.Group>(null),
    rElRef:   useRef<THREE.Group>(null),
    lHipRef:  useRef<THREE.Group>(null),
    lKnRef:   useRef<THREE.Group>(null),
    rHipRef:  useRef<THREE.Group>(null),
    rKnRef:   useRef<THREE.Group>(null),
  };

  // Tangentlyssnare med cleanup
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (e.key === " ") { e.preventDefault(); spaceDown.current = true; }
      if (e.key.toLowerCase() === "e") eCycleRef.current = true;
      if (e.key.toLowerCase() === "f") {
        freeCamRef.current = !freeCamRef.current;
        onFreeCamChangeRef.current(freeCamRef.current);
      }
      if (e.key === "Escape") onExitRef.current();
    };
    const onUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
      if (e.key === " ") spaceDown.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      keys.current.clear();
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const t   = clock.getElapsedTime();
    const k   = keys.current;
    const joy = joystickRef.current;

    // ── Kamera-reset ──────────────────────────────────────────────────────
    if (cameraResetRef.current) {
      cameraResetRef.current = false;
      if (freeCamRef.current) {
        freeCamRef.current = false;
        onFreeCamChangeRef.current(false);
      }
      // Nollställ touch-orbit
      cameraOrbitRef.current.yaw = 0;
      cameraOrbitRef.current.pitch = 0;
      cameraOrbitRef.current.distScale = 1;
      const by = H_THIGH + H_SHIN;
      const gp = new THREE.Vector3(pos.current.x, by + 0.8, pos.current.z);
      const sx = Math.sin(camYaw.current);
      const sz = -Math.cos(camYaw.current);
      camPos.current.copy(gp.clone().add(new THREE.Vector3(-sx * CAM_DIST, CAM_HEIGHT, -sz * CAM_DIST)));
      camLook.current.copy(gp);
    }

    // ── E-cycling ──────────────────────────────────────────────────────────
    if (eCycleRef.current && mounted.current) {
      eCycleRef.current = false;
      const meq = station.equipment.find(e => e.id === mounted.current!.eqId);
      const mt = meq ? getEquipmentById(meq.typeId) : null;
      if (meq && mt) {
        const exs = exercisesForKind(mt.detail?.kind ?? "");
        const idx = exs.findIndex(ex => ex.id === mounted.current!.exerciseId);
        const nid = exs[(idx + 1) % exs.length].id;
        mounted.current.exerciseId = nid;
        const makeOnChange = (exercises: typeof exs) => {
          const handler = (id: string) => {
            if (!mounted.current) return;
            mounted.current.exerciseId = id;
            onMountedExercisesRef.current({ exercises, exerciseId: id, onChange: handler });
          };
          return handler;
        };
        onMountedExercisesRef.current({
          exercises: exs, exerciseId: nid,
          onChange: makeOnChange(exs),
        });
      }
    } else {
      eCycleRef.current = false;
    }

    // ── Montera/demontera ──────────────────────────────────────────────────
    const triggerMount = mountTriggerRef.current || spaceDown.current;
    mountTriggerRef.current = false;
    spaceDown.current = false;

    if (triggerMount) {
      if (mounted.current) {
        mounted.current = null;
        onMountedExercisesRef.current(null);
        // Rensa proximity-state så etiketten försvinner
        nearEq.current = null;
        onNearEquipment(null);
      } else if (!nearEq.current) {
        // Fritt läge → random floor-trick (men inte samma ID två gånger i rad,
        // om det finns fler att välja mellan).
        const floorTricks = allExercises().filter(
          (e) =>
            e.apparatus.includes("floor") &&
            e.id !== "floor:stand" &&
            e.id !== "floor:handstand",
        );
        if (floorTricks.length) {
          const prev = oneShot.current?.exerciseId;
          const pool = floorTricks.length > 1 && prev
            ? floorTricks.filter((e) => e.id !== prev)
            : floorTricks;
          const pick = pool[Math.floor(Math.random() * pool.length)];
          oneShot.current = {
            exerciseId: pick.id,
            startT: t,
            startX: pos.current.x,
            startZ: pos.current.z,
            startRotY: rotY.current,
          };
        }
      } else if (nearEq.current) {
        const eq = station.equipment.find(e => e.id === nearEq.current!.id);
        const type = eq ? getEquipmentById(eq.typeId) : null;
        if (eq && type) {
          const kind = type.detail?.kind ?? "";
          const exs  = exercisesForKind(kind);
          if (exs.length) {
            const isHang = ["high-bar","rings","rings-free","uneven-bars"].includes(kind);
            const isRings = kind === "rings" || kind === "rings-free";
            const isSupport = ["parallel-bars","pommel-horse"].includes(kind);
            const baseY = isHang
              ? (isRings ? type.physicalHeightM - 0.18 : type.physicalHeightM + 0.04) - HANG_DIST
              : isSupport
              ? type.physicalHeightM + H_UPPER + H_LOWER - H_TORSO * 0.85
              : type.physicalHeightM + H_THIGH + H_SHIN;
            mounted.current = { eqId: eq.id, exerciseId: exs[0].id, baseY };
            pos.current = { x: eq.x, z: eq.y };
            // Rensa nearEq så etiketten försvinner direkt
            nearEq.current = null;
            onNearEquipment(null);
            // onChange måste också uppdatera React-state (mountedExerciseInfo.exerciseId)
            // för att övningsmenyn ska visa korrekt markering.
            const makeOnChange = (exercises: typeof exs) => {
              const handler = (id: string) => {
                if (!mounted.current) return;
                mounted.current.exerciseId = id;
                onMountedExercisesRef.current({
                  exercises,
                  exerciseId: id,
                  onChange: handler,
                });
              };
              return handler;
            };
            onMountedExercisesRef.current({
              exercises: exs,
              exerciseId: exs[0].id,
              onChange: makeOnChange(exs),
            });
          }
        }
      }
    }

    let pose: Pose;

    // ── Avbryt one-shot om monterad (mount prioriteras)
    if (mounted.current && oneShot.current) oneShot.current = null;
    // ── Avbryt one-shot om tiden passerat
    if (oneShot.current) {
      const def = lookupExercise(oneShot.current.exerciseId);
      const dur = def?.kfs.length ? def.kfs[def.kfs.length - 1].t : 0;
      if (!def || t - oneShot.current.startT >= dur) oneShot.current = null;
    }

    if (mounted.current) {
      // ── Monterad: spela övningsanimation ────────────────────────────────
      const { eqId, exerciseId, baseY: mountBaseY } = mounted.current;
      const eq = station.equipment.find(e => e.id === eqId);
      const type = eq ? getEquipmentById(eq.typeId) : null;
      const def = lookupExercise(exerciseId);
      pose = def ? evalExercise(def, t) : evalKF(IDLE_KFS, t);
      if (def?.baseRotY) pose.rootRotY += def.baseRotY;

      // Advance-logik (ping-pong gång, t.ex. bom).
      // Övningar med baseRotY har ansiktet mot lokal −Z → världens −X (vid baseRotY=PI/2).
      // Vi negerar rootX-förflyttningen så att gymnasten rör sig i sin blickriktning (−X).
      if (def?.advance && def.advance > 0) {
        const dur = def.kfs[def.kfs.length - 1].t;
        const dist = (t / dur) * def.advance;
        const range = def.range ?? 3.0;
        const period = range * 2;
        const phase = dist % period;
        if (phase <= range) {
          pose.rootX -= phase - range / 2;        // framåt i blickriktningen (−X)
        } else {
          pose.rootX -= (period - phase) - range / 2;  // retur
          pose.rootRotY += P;                          // vänd 180° för returvarvet
        }
      }

      // Transformera lokal rootX/rootZ till världskoordinater via utrustningens rotation
      if (eq && type) {
        const eqRot = -(eq.rotation * Math.PI) / 180;
        const c = Math.cos(eqRot), s = Math.sin(eqRot);
        const wx = pose.rootX * c - pose.rootZ * s;
        const wz = pose.rootX * s + pose.rootZ * c;
        pos.current.x = eq.x + wx;
        pos.current.z = eq.y + wz;
        pose.rootRotY += eqRot;
        pose.rootY = (eq.z ?? 0) + mountBaseY + (pose.rootY ?? 0);
        pose.rootX = 0;
        pose.rootZ = 0;
      } else {
        pose.rootY = mountBaseY + (pose.rootY ?? 0);
      }

      // Kamera: visa gymnast + redskap — mer utzoomad + touch-orbit (yaw + zoom)
      if (eq && type) {
        const orbit = cameraOrbitRef.current;
        const span = Math.max(type.widthM, type.heightM, type.physicalHeightM, 1.5);
        const cy = (eq.z ?? 0) + type.physicalHeightM * 0.5;
        const center = new THREE.Vector3(eq.x, cy, eq.y);
        const base = new THREE.Vector3(span * 1.6, span * 1.3, span * 2.3);
        // Rotera offset kring Y med orbit.yaw
        const c = Math.cos(orbit.yaw), s = Math.sin(orbit.yaw);
        const rx = base.x * c + base.z * s;
        const rz = -base.x * s + base.z * c;
        // Pitch lyfter kameran; distScale zoomar
        const ry = base.y + Math.sin(orbit.pitch) * span * 2.0;
        const offset = new THREE.Vector3(rx, ry, rz).multiplyScalar(orbit.distScale);
        const target = center.clone().add(offset);
        camPos.current.lerp(target, 0.04);
        camLook.current.lerp(center, 0.06);
      }
    } else if (oneShot.current) {
      // ── Fritt golv-trick (hjulning/kullerbytta/knähopp) ─────────────────
      const { exerciseId, startT, startX, startZ, startRotY } = oneShot.current;
      const def = lookupExercise(exerciseId)!;
      pose = evalExercise(def, t - startT);
      if (def.baseRotY) pose.rootRotY += def.baseRotY;
      // Gymnastens yaw vid start styr vilken riktning tricket utförs åt.
      pose.rootRotY += -startRotY;
      const baseY = H_THIGH + H_SHIN;
      pose.rootY += baseY;
      // rootX/rootZ är lokala offsets från gymnastens startposition (i dess
      // frame). Rotera dem till världen och addera till startposen.
      const c = Math.cos(-startRotY);
      const s = Math.sin(-startRotY);
      const wx = pose.rootX * c - pose.rootZ * s;
      const wz = pose.rootX * s + pose.rootZ * c;
      pos.current.x = startX + wx;
      pos.current.z = startZ + wz;
      pose.rootX = 0;
      pose.rootZ = 0;
      // Kamera som i fri rörelse
      if (!freeCamRef.current) {
        const orbit = cameraOrbitRef.current;
        const yawC = camYaw.current + orbit.yaw;
        const sx = Math.sin(yawC);
        const sz = -Math.cos(yawC);
        const dist = CAM_DIST * orbit.distScale;
        const horiz = dist * Math.cos(orbit.pitch);
        const vert  = CAM_HEIGHT + dist * Math.sin(orbit.pitch);
        const gymnPos = new THREE.Vector3(pos.current.x, baseY + 0.8, pos.current.z);
        const camTarget = gymnPos.clone().add(new THREE.Vector3(-sx * horiz, vert, -sz * horiz));
        const lookTarget = gymnPos.clone().add(new THREE.Vector3(0, 0.2, 0));
        camPos.current.lerp(camTarget, 0.06);
        camLook.current.lerp(lookTarget, 0.08);
      }
    } else {
      // ── Fri rörelse ───────────────────────────────────────────────────────
      const fwd  = (k.has("w") || k.has("arrowup"))   ? 1 : 0;
      const back = (k.has("s") || k.has("arrowdown"))  ? 1 : 0;
      const left = (k.has("a") || k.has("arrowleft"))  ? 1 : 0;
      const rgt  = (k.has("d") || k.has("arrowright")) ? 1 : 0;

      // Joystick-input (touch)
      const joyFwd  = -joy.dz;
      const joyTurn =  joy.dx;
      const turning = left || rgt || Math.abs(joyTurn) > 0.1;
      const moving  = fwd || back || Math.abs(joyFwd) > 0.1 || turning;

      // Rotera gymnast (rotY) + lät kamera följa med fördröjning (camYaw)
      rotY.current += (rgt - left + joyTurn) * TURN_SPEED * delta;
      // Lerpa camYaw mot rotY → gymnast vrids synbart innan kameran hinner med
      camYaw.current += (rotY.current - camYaw.current) * Math.min(1, delta * 6);

      // Flytta i gymnasten's framåtriktning
      const moveD = (fwd - back + joyFwd) * speedRef.current * delta;
      let newX = pos.current.x + Math.sin(rotY.current) * moveD;
      let newZ = pos.current.z - Math.cos(rotY.current) * moveD;

      // Kollision + proximity (kombinerad loop)
      let closest: { id: string; name: string } | null = null;
      let minDist = PROX;
      for (const eq of station.equipment) {
        const eqType = getEquipmentById(eq.typeId);
        if (!eqType) continue;
        const dx = eq.x - pos.current.x;
        const dz = eq.y - pos.current.z;
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d < minDist) {
          minDist = d;
          closest = { id: eq.id, name: eq.label ?? eqType.name };
        }
        // AABB-kollision (skippa nära redskap så montering fungerar)
        if (d > PROX && eqType) {
          const hw = (eqType.widthM * eq.scaleX) / 2 + 0.3;
          const hd = (eqType.heightM * eq.scaleY) / 2 + 0.3;
          if (Math.abs(newX - eq.x) < hw && Math.abs(newZ - eq.y) < hd) {
            newX = pos.current.x;
            newZ = pos.current.z;
          }
        }
      }

      pos.current.x = Math.max(0.5, Math.min(hallW - 0.5, newX));
      pos.current.z = Math.max(0.5, Math.min(hallH - 0.5, newZ));

      if (closest?.id !== nearEq.current?.id) {
        nearEq.current = closest;
        onNearEquipment(closest?.name ?? null);
      }

      // Välj animation
      const kfs  = moving ? WALK_KFS : IDLE_KFS;
      pose       = evalKF(kfs, t);
      pose.rootX = 0;
      pose.rootZ = 0;
      pose.rootRotY = -rotY.current;

      const baseY = H_THIGH + H_SHIN;
      pose.rootY += baseY;

      // Kamera bakifrån (skippa om fri kamera) – med touch-orbit-offset
      if (!freeCamRef.current) {
        const orbit = cameraOrbitRef.current;
        const yawC = camYaw.current + orbit.yaw;
        const sx = Math.sin(yawC);
        const sz = -Math.cos(yawC);
        const dist = CAM_DIST * orbit.distScale;
        const horiz = dist * Math.cos(orbit.pitch);
        const vert  = CAM_HEIGHT + dist * Math.sin(orbit.pitch);
        const gymnPos = new THREE.Vector3(pos.current.x, baseY + 0.8, pos.current.z);
        const camTarget = gymnPos.clone().add(new THREE.Vector3(-sx * horiz, vert, -sz * horiz));
        const lookTarget = gymnPos.clone().add(new THREE.Vector3(0, 0.2, 0));
        camPos.current.lerp(camTarget, 0.06);
        camLook.current.lerp(lookTarget, 0.08);
      }
    }

    // ── Applicera kamera (skippa om fri kamera) ─────────────────────────
    if (!freeCamRef.current) {
      camera.position.copy(camPos.current);
      camera.lookAt(camLook.current);
    }

    // ── Applicera pose på refs ─────────────────────────────────────────────
    if (rootRef.current) {
      rootRef.current.position.set(pos.current.x, pose.rootY, pos.current.z);
      rootRef.current.rotation.x = pose.rootRotX;
      rootRef.current.rotation.y = pose.rootRotY;
      rootRef.current.rotation.z = pose.rootRotZ;
    }
    const r = bodyRefs;
    if (r.spineRef.current) { r.spineRef.current.rotation.x = pose.spineX; r.spineRef.current.rotation.z = pose.spineZ; }
    if (r.headRef.current)  { r.headRef.current.rotation.x  = pose.headX;  r.headRef.current.rotation.z  = pose.headZ; }
    if (r.lShRef.current)   { r.lShRef.current.rotation.x = pose.lShX;  r.lShRef.current.rotation.z = pose.lShZ; }
    if (r.lElRef.current)     r.lElRef.current.rotation.x = pose.lElX;
    if (r.rShRef.current)   { r.rShRef.current.rotation.x = pose.rShX;  r.rShRef.current.rotation.z = pose.rShZ; }
    if (r.rElRef.current)     r.rElRef.current.rotation.x = pose.rElX;
    if (r.lHipRef.current)  { r.lHipRef.current.rotation.x = pose.lHipX; r.lHipRef.current.rotation.z = pose.lHipZ; }
    if (r.lKnRef.current)     r.lKnRef.current.rotation.x  = pose.lKnX;
    if (r.rHipRef.current)  { r.rHipRef.current.rotation.x = pose.rHipX; r.rHipRef.current.rotation.z = pose.rHipZ; }
    if (r.rKnRef.current)     r.rKnRef.current.rotation.x  = pose.rKnX;
  });

  return (
    <group ref={rootRef}>
      <GymnastBody color={color} skin={SKIN} hair={HAIR} refs={bodyRefs} />
    </group>
  );
}

// Exportera pend för eventuell återanvändning
export { pend };
