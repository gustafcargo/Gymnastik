/**
 * GameGymnast3D – spelbar gymnast som rör sig fritt i salen.
 * Kroppen renderas via <GymnastBody> som enkelt kan bytas mot GLB-modell.
 */
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Station } from "../../types";
import { getEquipmentById } from "../../catalog/equipment";
import { exercisesForKind, type Exercise } from "../../catalog/exercises";
import { EXERCISES } from "./Gymnast3D";

// ─── Återanvänd proportioner ──────────────────────────────────────────────────
const H_HEAD  = 0.09;
const H_NECK  = 0.09;
const H_TORSO = 0.46;
const H_UPPER = 0.27;
const H_LOWER = 0.24;
const H_THIGH = 0.38;
const H_SHIN  = 0.35;
const R_BODY  = 0.068;
const R_LIMB  = 0.036;
const R_LEG   = 0.046;
const W_SHLDR = 0.19;
const W_HIP   = 0.11;
const HANG_DIST = H_TORSO * 0.85 + H_UPPER + H_LOWER;
const P = Math.PI;

type Pose = {
  spineX: number; spineZ: number;
  headX: number;  headZ: number;
  lShX: number; lShZ: number; lElX: number;
  rShX: number; rShZ: number; rElX: number;
  lHipX: number; lKnX: number;
  rHipX: number; rKnX: number;
  rootX: number; rootY: number; rootZ: number;
  rootRotX: number; rootRotY: number;
};

const ZERO: Pose = {
  spineX:0,spineZ:0,headX:0,headZ:0,
  lShX:0,lShZ:0,lElX:0,rShX:0,rShZ:0,rElX:0,
  lHipX:0,lKnX:0,rHipX:0,rKnX:0,
  rootX:0,rootY:0,rootZ:0,rootRotX:0,rootRotY:0,
};

// ─── Gångcykel (fria rörelsecykeln, rootX/Z styrs externt) ───────────────────
type KF = { t: number; pose: Pose };

function lerpPose(a: Pose, b: Pose, alpha: number): Pose {
  const l = (k: keyof Pose) => (a[k] as number) + ((b[k] as number) - (a[k] as number)) * alpha;
  return {
    spineX:l("spineX"),spineZ:l("spineZ"),headX:l("headX"),headZ:l("headZ"),
    lShX:l("lShX"),lShZ:l("lShZ"),lElX:l("lElX"),
    rShX:l("rShX"),rShZ:l("rShZ"),rElX:l("rElX"),
    lHipX:l("lHipX"),lKnX:l("lKnX"),rHipX:l("rHipX"),rKnX:l("rKnX"),
    rootX:l("rootX"),rootY:l("rootY"),rootZ:l("rootZ"),
    rootRotX:l("rootRotX"),rootRotY:l("rootRotY"),
  };
}

function evalKF(kfs: KF[], t: number): Pose {
  if (!kfs.length) return ZERO;
  if (kfs.length === 1) return kfs[0].pose;
  const dur = kfs[kfs.length - 1].t;
  const tn  = t % dur;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (tn >= kfs[i].t && tn < kfs[i+1].t) {
      const a = (tn - kfs[i].t) / (kfs[i+1].t - kfs[i].t);
      return lerpPose(kfs[i].pose, kfs[i+1].pose, a);
    }
  }
  return kfs[kfs.length - 1].pose;
}

// Gångcykel – 4 nyckelbilder, 0.6 s/cykel
const WALK_KFS: KF[] = [
  { t:0.0,  pose:{...ZERO,lHipX:-P*0.18,rHipX:P*0.22,rKnX:P*0.10,lShX:P*0.12,rShX:-P*0.10,lShZ:-P*0.08,rShZ:P*0.08,spineZ:0.02 } },
  { t:0.15, pose:{...ZERO,lHipX:P*0.04, rHipX:-P*0.08,rKnX:P*0.18,spineZ:-0.01,rootY:0.015 } },
  { t:0.30, pose:{...ZERO,rHipX:-P*0.18,lHipX:P*0.22,lKnX:P*0.10,rShX:P*0.12,lShX:-P*0.10,lShZ:-P*0.08,rShZ:P*0.08,spineZ:-0.02 } },
  { t:0.45, pose:{...ZERO,rHipX:P*0.04, lHipX:-P*0.08,lKnX:P*0.18,spineZ:0.01,rootY:0.015 } },
  { t:0.60, pose:{...ZERO,lHipX:-P*0.18,rHipX:P*0.22,rKnX:P*0.10,lShX:P*0.12,rShX:-P*0.10,lShZ:-P*0.08,rShZ:P*0.08,spineZ:0.02 } },
];

// Idle (subtil andning)
const IDLE_KFS: KF[] = [
  { t:0,   pose:{...ZERO,lShZ:-0.05,rShZ:0.05} },
  { t:2.0, pose:{...ZERO,spineX:P*0.015,rootY:0.008,lShZ:0.04,rShZ:-0.04} },
  { t:4.0, pose:{...ZERO,lShZ:-0.05,rShZ:0.05} },
];

function pend(a: number) {
  return { rootZ:-HANG_DIST*Math.sin(a), rootY:HANG_DIST*(1-Math.cos(a)) };
}

// R3F:s ref-prop förväntar sig Ref<T> (utan null); denna cast löser det.
function r3f<T>(ref: React.RefObject<T | null>): React.Ref<T> {
  return ref as React.Ref<T>;
}

// ─── GymnastBody – den utbytbara renderingskomponenten ───────────────────────
function LeotardSeg({ len,r,color,up=false }:{len:number;r:number;color:string;up?:boolean}) {
  return (
    <mesh position={[0,up?len/2:-len/2,0]} castShadow>
      <capsuleGeometry args={[r,Math.max(0.001,len-r*2),6,10]} />
      <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} clearcoat={0.25} clearcoatRoughness={0.35} />
    </mesh>
  );
}
function SkinSeg({ len,r,color,up=false }:{len:number;r:number;color:string;up?:boolean}) {
  return (
    <mesh position={[0,up?len/2:-len/2,0]} castShadow>
      <capsuleGeometry args={[r,Math.max(0.001,len-r*2),6,10]} />
      <meshPhysicalMaterial color={color} roughness={0.72} metalness={0} />
    </mesh>
  );
}
function Joint({ r,color,leotard=false }:{r:number;color:string;leotard?:boolean}) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[r,10,8]} />
      <meshPhysicalMaterial color={color} roughness={leotard?0.55:0.72} metalness={leotard?0.02:0}
        clearcoat={leotard?0.25:0} clearcoatRoughness={0.35} />
    </mesh>
  );
}

type BodyRefs = {
  spineRef: React.RefObject<THREE.Group | null>;
  headRef:  React.RefObject<THREE.Group | null>;
  lShRef:   React.RefObject<THREE.Group | null>;
  lElRef:   React.RefObject<THREE.Group | null>;
  rShRef:   React.RefObject<THREE.Group | null>;
  rElRef:   React.RefObject<THREE.Group | null>;
  lHipRef:  React.RefObject<THREE.Group | null>;
  lKnRef:   React.RefObject<THREE.Group | null>;
  rHipRef:  React.RefObject<THREE.Group | null>;
  rKnRef:   React.RefObject<THREE.Group | null>;
};

/**
 * GymnastBody – utbytbar mot en GLB-modell senare.
 * Ta emot refs för alla leder; föräldern sätter rotationer via useFrame.
 */
function GymnastBody({ color, skin, hair, refs }: {
  color: string; skin: string; hair: string; refs: BodyRefs;
}) {
  return (
    <>
      <Joint r={0.065} color={color} leotard />
      <group ref={r3f(refs.spineRef)}>
        <LeotardSeg len={H_TORSO} r={R_BODY} color={color} up />
        <group position={[0,H_TORSO-0.01,0]}>
          <SkinSeg len={H_NECK} r={0.030} color={skin} up />
        </group>
        <group ref={r3f(refs.headRef)} position={[0,H_TORSO+H_NECK+H_HEAD*0.85,0]}>
          <mesh castShadow>
            <sphereGeometry args={[H_HEAD,14,10]} />
            <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
          </mesh>
          <mesh position={[0,H_HEAD*0.18,0]} castShadow>
            <sphereGeometry args={[H_HEAD*0.84,12,8]} />
            <meshPhysicalMaterial color={hair} roughness={0.82} metalness={0.03} clearcoat={0.15} clearcoatRoughness={0.5} />
          </mesh>
          <mesh position={[0,H_HEAD*0.45,-H_HEAD*0.55]} rotation={[0.55,0,0]} castShadow>
            <capsuleGeometry args={[0.018,0.08,4,6]} />
            <meshPhysicalMaterial color={hair} roughness={0.85} metalness={0} />
          </mesh>
        </group>
        {([-W_SHLDR,W_SHLDR] as number[]).map((x,i) => (
          <mesh key={i} position={[x,H_TORSO*0.85,0]} castShadow>
            <sphereGeometry args={[0.048,10,8]} />
            <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} clearcoat={0.25} clearcoatRoughness={0.35} />
          </mesh>
        ))}
        <group ref={r3f(refs.lShRef)} position={[-W_SHLDR,H_TORSO*0.85,0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB} color={color} />
          <group ref={r3f(refs.lElRef)} position={[0,-H_UPPER,0]}>
            <Joint r={R_LIMB*1.10} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB*0.85} color={skin} />
            <mesh position={[0,-H_LOWER,0]} castShadow>
              <sphereGeometry args={[0.028,8,6]} />
              <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>
        <group ref={r3f(refs.rShRef)} position={[W_SHLDR,H_TORSO*0.85,0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB} color={color} />
          <group ref={r3f(refs.rElRef)} position={[0,-H_UPPER,0]}>
            <Joint r={R_LIMB*1.10} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB*0.85} color={skin} />
            <mesh position={[0,-H_LOWER,0]} castShadow>
              <sphereGeometry args={[0.028,8,6]} />
              <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>
      </group>
      <Joint r={0.052} color={color} leotard />
      <group ref={r3f(refs.lHipRef)} position={[-W_HIP,0,0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG} color={color} />
        <group ref={r3f(refs.lKnRef)} position={[0,-H_THIGH,0]}>
          <Joint r={R_LEG*1.05} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG*0.85} color={skin} />
          <mesh position={[0,-H_SHIN-0.015,0.028]} rotation={[-P*0.20,0,0]} castShadow>
            <capsuleGeometry args={[0.024,0.058,4,8]} />
            <meshPhysicalMaterial color="#F0F0F0" roughness={0.75} metalness={0} />
          </mesh>
        </group>
      </group>
      <group ref={r3f(refs.rHipRef)} position={[W_HIP,0,0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG} color={color} />
        <group ref={r3f(refs.rKnRef)} position={[0,-H_THIGH,0]}>
          <Joint r={R_LEG*1.05} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG*0.85} color={skin} />
          <mesh position={[0,-H_SHIN-0.015,0.028]} rotation={[-P*0.20,0,0]} castShadow>
            <capsuleGeometry args={[0.024,0.058,4,8]} />
            <meshPhysicalMaterial color="#F0F0F0" roughness={0.75} metalness={0} />
          </mesh>
        </group>
      </group>
    </>
  );
}

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
  onNearEquipment: (name: string | null) => void;
  onMountedExercises: (info: MountedExerciseInfo | null) => void;
  onExit: () => void;
  color?: string;
};

const SPEED      = 2.2;   // m/s
const TURN_SPEED = 2.5;   // rad/s
const PROX       = 1.8;   // m, monteringsradie
const CAM_DIST   = 5.5;   // m bakom gymnasten
const CAM_HEIGHT = 2.2;   // m ovanför höfterna

export function GameGymnast3D({
  station, hallW, hallH, joystickRef, mountTriggerRef,
  onNearEquipment, onMountedExercises, onExit, color = "#C2185B",
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
  const onMountedExercisesRef = useRef(onMountedExercises);
  onMountedExercisesRef.current = onMountedExercises;

  // Kamera-mål
  const camPos  = useRef(new THREE.Vector3());
  const camLook = useRef(new THREE.Vector3());

  // Tangenter
  const keys = useRef(new Set<string>());

  // Spacebar (edge-trigger)
  const spaceDown = useRef(false);

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

  // Registrera tangentlyssnare en gång
  const listenersAdded = useRef(false);
  if (!listenersAdded.current) {
    listenersAdded.current = true;
    const onDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (e.key === " ") { e.preventDefault(); spaceDown.current = true; }
      if (e.key === "Escape") onExit();
    };
    const onUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
      if (e.key === " ") spaceDown.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
  }

  useFrame(({ clock }, delta) => {
    const t   = clock.getElapsedTime();
    const k   = keys.current;
    const joy = joystickRef.current;

    // ── Montera/demontera ──────────────────────────────────────────────────
    const triggerMount = mountTriggerRef.current || spaceDown.current;
    mountTriggerRef.current = false;
    spaceDown.current = false;

    if (triggerMount) {
      if (mounted.current) {
        mounted.current = null;
        onMountedExercisesRef.current(null);
      } else if (nearEq.current) {
        const eq = station.equipment.find(e => e.id === nearEq.current!.id);
        const type = eq ? getEquipmentById(eq.typeId) : null;
        if (eq && type) {
          const kind = type.detail?.kind ?? "";
          const exs  = exercisesForKind(kind);
          if (exs.length) {
            const isHang = ["high-bar","rings","rings-free","uneven-bars"].includes(kind);
            const isSupport = ["parallel-bars","pommel-horse"].includes(kind);
            const baseY = isHang
              ? type.physicalHeightM + 0.04 - HANG_DIST
              : isSupport
              ? type.physicalHeightM + H_UPPER + H_LOWER - H_TORSO * 0.85
              : type.physicalHeightM + H_THIGH + H_SHIN;
            mounted.current = { eqId: eq.id, exerciseId: exs[0].id, baseY };
            pos.current = { x: eq.x, z: eq.y };
            onMountedExercisesRef.current({
              exercises: exs,
              exerciseId: exs[0].id,
              onChange: (id) => { if (mounted.current) mounted.current.exerciseId = id; },
            });
          }
        }
      }
    }

    let pose: Pose;

    if (mounted.current) {
      // ── Monterad: spela övningsanimation ────────────────────────────────
      const { exerciseId, baseY } = mounted.current;
      const def = EXERCISES[exerciseId];
      pose = def ? evalKF(def.kfs, t) : evalKF(IDLE_KFS, t);
      if (def?.baseRotY) pose.rootRotY += def.baseRotY;
      pose.rootY = baseY + (pose.rootY ?? 0);

      // Kamera: visa gymnast + redskap
      const eq = station.equipment.find(e => e.id === mounted.current!.eqId);
      const type = eq ? getEquipmentById(eq.typeId) : null;
      if (eq && type) {
        const span   = Math.max(type.widthM, type.heightM, type.physicalHeightM, 1.5);
        const center = new THREE.Vector3(eq.x, type.physicalHeightM * 0.5, eq.y);
        const target = center.clone().add(new THREE.Vector3(span * 1.1, span * 0.8, span * 1.5));
        camPos.current.lerp(target, 0.04);
        camLook.current.lerp(center, 0.06);
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
      rotY.current += (rgt - left - joyTurn) * TURN_SPEED * delta;
      // Lerpa camYaw mot rotY → gymnast vrids synbart innan kameran hinner med
      camYaw.current += (rotY.current - camYaw.current) * Math.min(1, delta * 6);

      // Flytta i gymnasten's framåtriktning (W/↑ = framåt = bort från kameran)
      const moveD = (fwd - back + joyFwd) * SPEED * delta;
      pos.current.x += Math.sin(rotY.current) * moveD;
      pos.current.z -= Math.cos(rotY.current) * moveD;

      // Klämma till hallens gränser
      pos.current.x = Math.max(0.5, Math.min(hallW - 0.5, pos.current.x));
      pos.current.z = Math.max(0.5, Math.min(hallH - 0.5, pos.current.z));

      // Välj animation
      const kfs  = moving ? WALK_KFS : IDLE_KFS;
      pose       = evalKF(kfs, t);
      pose.rootX = 0;
      pose.rootZ = 0;
      pose.rootRotY = rotY.current;

      const baseY = H_THIGH + H_SHIN;
      pose.rootY += baseY;

      // Proximity-check
      let closest: { id: string; name: string } | null = null;
      let minDist = PROX;
      for (const eq of station.equipment) {
        const dx = eq.x - pos.current.x;
        const dz = eq.y - pos.current.z;
        const d  = Math.sqrt(dx*dx + dz*dz);
        if (d < minDist) {
          minDist = d;
          const type = getEquipmentById(eq.typeId);
          closest = { id: eq.id, name: eq.label ?? type?.name ?? "" };
        }
      }
      if (closest?.id !== nearEq.current?.id) {
        nearEq.current = closest;
        onNearEquipment(closest?.name ?? null);
      }

      // Kamera bakifrån – använd camYaw (fördröjd) för att göra gymnastvridningen synbar
      const sx = Math.sin(camYaw.current);
      const sz = -Math.cos(camYaw.current);
      const gymnPos = new THREE.Vector3(pos.current.x, baseY + 0.8, pos.current.z);
      const camTarget = gymnPos.clone().add(new THREE.Vector3(-sx * CAM_DIST, CAM_HEIGHT, -sz * CAM_DIST));
      const lookTarget = gymnPos.clone().add(new THREE.Vector3(0, 0.2, 0));

      camPos.current.lerp(camTarget, 0.06);
      camLook.current.lerp(lookTarget, 0.08);
    }

    // ── Applicera kamera ───────────────────────────────────────────────────
    camera.position.copy(camPos.current);
    camera.lookAt(camLook.current);

    // ── Applicera pose på refs ─────────────────────────────────────────────
    if (rootRef.current) {
      rootRef.current.position.set(pos.current.x, pose.rootY, pos.current.z);
      rootRef.current.rotation.x = pose.rootRotX;
      rootRef.current.rotation.y = pose.rootRotY;
    }
    const r = bodyRefs;
    if (r.spineRef.current) { r.spineRef.current.rotation.x = pose.spineX; r.spineRef.current.rotation.z = pose.spineZ; }
    if (r.headRef.current)  { r.headRef.current.rotation.x  = pose.headX;  r.headRef.current.rotation.z  = pose.headZ; }
    if (r.lShRef.current)   { r.lShRef.current.rotation.x = pose.lShX;  r.lShRef.current.rotation.z = pose.lShZ; }
    if (r.lElRef.current)     r.lElRef.current.rotation.x = pose.lElX;
    if (r.rShRef.current)   { r.rShRef.current.rotation.x = pose.rShX;  r.rShRef.current.rotation.z = pose.rShZ; }
    if (r.rElRef.current)     r.rElRef.current.rotation.x = pose.rElX;
    if (r.lHipRef.current)    r.lHipRef.current.rotation.x = pose.lHipX;
    if (r.lKnRef.current)     r.lKnRef.current.rotation.x  = pose.lKnX;
    if (r.rHipRef.current)    r.rHipRef.current.rotation.x = pose.rHipX;
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
