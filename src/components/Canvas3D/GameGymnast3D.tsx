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
import { playMount, playDismount, playTrick, playLanding, playStep, playDenied } from "../../lib/sfx";
import type { EffectsHandle } from "./EffectsLayer";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { sendState } from "../../lib/multiplayer";

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
  effectsRef?: React.MutableRefObject<EffectsHandle | null>;
};

const TURN_SPEED = 2.5;   // rad/s
const PROX       = 1.8;   // m, monteringsradie
const CAM_DIST   = 5.5;   // m bakom gymnasten
const CAM_HEIGHT = 2.2;   // m ovanför höfterna

export function GameGymnast3D({
  station, hallW, hallH, joystickRef, mountTriggerRef, speedRef, cameraResetRef,
  cameraOrbitRef, effectsRef,
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
  // Senaste steg-tid (s) för throttlad stegklickljud under walk.
  const lastStepT = useRef(0);
  // Senaste broadcast-tid (s) för multiplayer-throttling (~15 Hz).
  const lastBroadcastT = useRef(0);

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
        playDismount();
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
          playTrick();
          effectsRef?.current?.spawn({
            kind: "sparkle",
            pos: { x: pos.current.x, y: 0.3, z: pos.current.z },
          });
        }
      } else if (nearEq.current) {
        const eq = station.equipment.find(e => e.id === nearEq.current!.id);
        const type = eq ? getEquipmentById(eq.typeId) : null;
        // Multiplayer-lås: om en fjärrspelare redan är på detta redskap, neka.
        const mpPlayers = useMultiplayerStore.getState().players;
        const taken = eq ? Object.values(mpPlayers).some((p) => p.mountedEqId === eq.id) : false;
        if (taken) {
          playDenied();
        } else if (eq && type) {
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
            playMount();
            effectsRef?.current?.spawn({ kind: "ring", pos: { x: eq.x, y: 0.05, z: eq.y } });
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
      if (!def || t - oneShot.current.startT >= dur) {
        const landX = pos.current.x;
        const landZ = pos.current.z;
        oneShot.current = null;
        playLanding();
        effectsRef?.current?.spawn({
          kind: "dust",
          pos: { x: landX, y: 0.05, z: landZ },
        });
      }
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

      // Transformera lokal rootX/rootZ till världskoordinater via utrustningens
      // rotation. Three.js R_y(θ) mappar lokal (x,z) → (x·cos θ + z·sin θ,
       // −x·sin θ + z·cos θ). Gymnastens rotation.y sätts till eqRot strax
      // nedan, så samma formel används här för att hamna i hennes värld-frame.
      // Tidigare transformerade vi med −eqRot vilket spegelvände rörelsen på
      // vridna redskap (gymnasten gick baklänges + handlåset tappade grepp).
      if (eq && type) {
        const eqRot = -(eq.rotation * Math.PI) / 180;
        const c = Math.cos(eqRot), s = Math.sin(eqRot);
        const wx =  pose.rootX * c + pose.rootZ * s;
        const wz = -pose.rootX * s + pose.rootZ * c;
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
      // rootX/rootZ är lokala offsets i gymnastens frame (hon tittar mot
      // lokal −Z). Gymnastens rendering-rotation är Y-rot(-startRotY), så vi
      // applicerar samma Y-rotation för att få world-positionen. Viktigt:
      // tecknet på sin måste matcha rotation.y; annars blir rörelsen speglad
      // när gymnasten står vriden åt andra hållet.
      const c = Math.cos(startRotY);
      const s = Math.sin(startRotY);
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

      // Kollision + proximity. Mäter avstånd till REDSKAPETS KANT (inte
      // centrum) i roterat lokalt frame så långa/vridna redskap hanteras
      // korrekt. Kollisionen är axel-separerad (slide): om diagonal rörelse
      // blockeras försöker vi X-axel och Z-axel var för sig, så gymnasten
      // glider längs kanten istället för att fastna på hörnen.
      type Box = { x: number; y: number; c: number; s: number; halfW: number; halfD: number };
      const boxes: Box[] = [];
      let closest: { id: string; name: string } | null = null;
      let minDist = PROX;
      for (const eq of station.equipment) {
        const eqType = getEquipmentById(eq.typeId);
        if (!eqType) continue;
        const eqRot = -(eq.rotation * Math.PI) / 180;
        const c = Math.cos(eqRot), s = Math.sin(eqRot);
        const halfW = (eqType.widthM  * eq.scaleX) / 2;
        const halfD = (eqType.heightM * eq.scaleY) / 2;
        boxes.push({ x: eq.x, y: eq.y, c, s, halfW, halfD });

        // World → equipment-local: invers av R_y(eqRot)
        const dx = pos.current.x - eq.x;
        const dz = pos.current.z - eq.y;
        const localX = dx * c - dz * s;
        const localZ = dx * s + dz * c;
        const ex = Math.max(0, Math.abs(localX) - halfW);
        const ez = Math.max(0, Math.abs(localZ) - halfD);
        const edgeDist = Math.sqrt(ex * ex + ez * ez);

        if (edgeDist < minDist) {
          minDist = edgeDist;
          closest = { id: eq.id, name: eq.label ?? eqType.name };
        }
      }

      const PAD = 0.3;
      const inBox = (b: Box, wx: number, wz: number) => {
        const ddx = wx - b.x;
        const ddz = wz - b.y;
        const lx = ddx * b.c - ddz * b.s;
        const lz = ddx * b.s + ddz * b.c;
        return Math.abs(lx) < b.halfW + PAD && Math.abs(lz) < b.halfD + PAD;
      };
      const blocked = (wx: number, wz: number) => boxes.some((b) => inBox(b, wx, wz));

      // Om gymnasten redan är inuti ett redskap (t.ex. efter demontering)
      // stängs kollisionen av tills hon tar sig ut, annars kan hon fastna.
      const wasInside = blocked(pos.current.x, pos.current.z);
      if (!wasInside && blocked(newX, newZ)) {
        const canX = !blocked(newX, pos.current.z);
        const canZ = !blocked(pos.current.x, newZ);
        if (canX && !canZ) {
          newZ = pos.current.z;
        } else if (!canX && canZ) {
          newX = pos.current.x;
        } else if (canX && canZ) {
          // Båda axlarna OK var för sig men inte samtidigt (diagonal klämning
          // mellan två redskap). Välj axeln som flyttar mest.
          if (Math.abs(newX - pos.current.x) >= Math.abs(newZ - pos.current.z)) {
            newZ = pos.current.z;
          } else {
            newX = pos.current.x;
          }
        } else {
          newX = pos.current.x;
          newZ = pos.current.z;
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

      // Stegklick var 0.3 s när gymnasten går (matchar walk-cykelns halva).
      if (moving && t - lastStepT.current > 0.3) {
        lastStepT.current = t;
        playStep();
      }
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
      // YXZ-order: yaw (Y) appliceras SIST, så roll/pitch (X/Z) sker i
      // gymnastens lokala frame. Viktigt för floor-tricks där hon kan stå
      // vriden åt valfritt håll och ändå skall rulla framåt (rootRotX) eller
      // hjula (rootRotZ) i sin egen blickriktning istället för världens axlar.
      rootRef.current.rotation.order = "YXZ";
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

    // ── Golv-clamp för one-shot-tricks ────────────────────────────────
    // Studions PosePreview har samma logik. Vissa floor-KFs har negativa
    // rootY-värden (-1.81 för forward-roll etc.) som förutsätter att
    // gymnasten "sitter på golvet" under rullningen. Utan clamp sjunker
    // hela kroppen under golvytan och animationen ser trasig ut.
    // Körs bara under one-shot (mount/walk är välkalibrerade).
    if (oneShot.current && rootRef.current) {
      rootRef.current.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rootRef.current);
      if (isFinite(box.min.y) && box.min.y < 0) {
        rootRef.current.position.y -= box.min.y;
      }
    }

    // ── Multiplayer-broadcast (~15 Hz) + GC av stale spelare ──────────────
    if (t - lastBroadcastT.current > 0.066) {
      lastBroadcastT.current = t;
      const mp = useMultiplayerStore.getState();
      if (mp.channel && mp.roomCode) {
        // Skicka endast numeriska pose-fält (inte objekt) för mindre payload.
        const poseOut: Record<string, number> = {};
        for (const key of Object.keys(pose) as Array<keyof Pose>) {
          poseOut[key] = (pose as Pose)[key];
        }
        sendState(mp.channel, {
          id: mp.playerId,
          name: mp.playerName,
          color: mp.playerColor,
          pos: { x: pos.current.x, y: pose.rootY, z: pos.current.z },
          rotY: -rotY.current,
          pose: poseOut,
          mountedEqId: mounted.current?.eqId ?? null,
          t: Date.now(),
        });
        mp.reapStale(8000);
      }
    }
  });

  return (
    <group ref={rootRef}>
      <GymnastBody color={color} skin={SKIN} hair={HAIR} refs={bodyRefs} />
    </group>
  );
}

// Exportera pend för eventuell återanvändning
export { pend };
