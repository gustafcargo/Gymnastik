/**
 * GameGymnast3D – spelbar gymnast som rör sig fritt i salen.
 * Kroppen renderas via <GymnastBody> som enkelt kan bytas mot GLB-modell.
 */
import { useRef, useEffect } from "react";
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
  // Accent-färg: lite ljusare variant av leotard-färgen för detaljer
  return (
    <>
      {/* Höftkula */}
      <Joint r={0.062} color={color} leotard />

      {/* Kropp + huvud */}
      <group ref={r3f(refs.spineRef)}>

        {/* Torso – avsmalnande cylinder (bredare axlar, smalare midja) */}
        <mesh position={[0, H_TORSO * 0.5, 0]} castShadow>
          <cylinderGeometry args={[R_BODY * 0.80, R_BODY * 1.05, H_TORSO, 12]} />
          <meshPhysicalMaterial color={color} roughness={0.48} metalness={0.04}
            clearcoat={0.35} clearcoatRoughness={0.30} />
        </mesh>

        {/* Leotard-V-ringning (subtil detalj på framsidan) */}
        <mesh position={[0, H_TORSO * 0.88, -R_BODY * 0.78]} rotation={[P * 0.18, 0, 0]} castShadow>
          <capsuleGeometry args={[0.008, 0.06, 4, 6]} />
          <meshPhysicalMaterial color={skin} roughness={0.55} metalness={0} />
        </mesh>

        {/* Hals */}
        <group position={[0, H_TORSO + 0.01, 0]}>
          <SkinSeg len={H_NECK} r={0.028} color={skin} up />
        </group>

        {/* Huvud-grupp */}
        <group ref={r3f(refs.headRef)} position={[0, H_TORSO + H_NECK + H_HEAD * 0.90, 0]}>

          {/* Huvud */}
          <mesh castShadow>
            <sphereGeometry args={[H_HEAD, 16, 12]} />
            <meshPhysicalMaterial color={skin} roughness={0.62} metalness={0} />
          </mesh>

          {/* Hår – täcker topp + baksida */}
          <mesh position={[0, H_HEAD * 0.14, H_HEAD * 0.06]} castShadow>
            <sphereGeometry args={[H_HEAD * 0.87, 14, 10]} />
            <meshPhysicalMaterial color={hair} roughness={0.80} metalness={0.04}
              clearcoat={0.20} clearcoatRoughness={0.45} />
          </mesh>

          {/* Hårsektion bak som täcker occipital */}
          <mesh position={[0, H_HEAD * 0.02, H_HEAD * 0.55]} castShadow>
            <sphereGeometry args={[H_HEAD * 0.60, 10, 8]} />
            <meshPhysicalMaterial color={hair} roughness={0.80} metalness={0.04} />
          </mesh>

          {/* Hästsvans – tre sammanlänkade kapslar nedåt bakifrån */}
          <mesh position={[0, -H_HEAD * 0.10, H_HEAD * 0.80]} rotation={[P * 0.22, 0, 0]} castShadow>
            <capsuleGeometry args={[0.020, 0.10, 4, 8]} />
            <meshPhysicalMaterial color={hair} roughness={0.82} metalness={0} />
          </mesh>
          <mesh position={[0, -H_HEAD * 0.28, H_HEAD * 1.10]} rotation={[P * 0.32, 0, 0]} castShadow>
            <capsuleGeometry args={[0.016, 0.09, 4, 8]} />
            <meshPhysicalMaterial color={hair} roughness={0.82} metalness={0} />
          </mesh>
          <mesh position={[0, -H_HEAD * 0.46, H_HEAD * 1.35]} rotation={[P * 0.42, 0, 0]} castShadow>
            <capsuleGeometry args={[0.012, 0.07, 4, 8]} />
            <meshPhysicalMaterial color={hair} roughness={0.82} metalness={0} />
          </mesh>

          {/* Ögon */}
          <mesh position={[-H_HEAD * 0.37, H_HEAD * 0.08, -H_HEAD * 0.88]} castShadow>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshPhysicalMaterial color="#1a1a2e" roughness={0.3} metalness={0.1} />
          </mesh>
          <mesh position={[ H_HEAD * 0.37, H_HEAD * 0.08, -H_HEAD * 0.88]} castShadow>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshPhysicalMaterial color="#1a1a2e" roughness={0.3} metalness={0.1} />
          </mesh>

          {/* Ögonvitor (subtil vit spegel) */}
          <mesh position={[-H_HEAD * 0.37, H_HEAD * 0.09, -H_HEAD * 0.895]} castShadow>
            <sphereGeometry args={[0.011, 6, 5]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.2} metalness={0} />
          </mesh>
          <mesh position={[ H_HEAD * 0.37, H_HEAD * 0.09, -H_HEAD * 0.895]} castShadow>
            <sphereGeometry args={[0.011, 6, 5]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.2} metalness={0} />
          </mesh>

          {/* Näsa */}
          <mesh position={[0, -H_HEAD * 0.06, -H_HEAD * 0.96]} castShadow>
            <sphereGeometry args={[0.012, 6, 5]} />
            <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
          </mesh>

          {/* Mun (liten oval) */}
          <mesh position={[0, -H_HEAD * 0.24, -H_HEAD * 0.93]} rotation={[P * 0.06, 0, 0]} castShadow>
            <capsuleGeometry args={[0.008, 0.026, 4, 6]} />
            <meshPhysicalMaterial color="#c97070" roughness={0.6} metalness={0} />
          </mesh>
        </group>

        {/* Axelkulor */}
        {([-W_SHLDR, W_SHLDR] as number[]).map((x, i) => (
          <mesh key={i} position={[x, H_TORSO * 0.87, 0]} castShadow>
            <sphereGeometry args={[0.052, 10, 8]} />
            <meshPhysicalMaterial color={color} roughness={0.48} metalness={0.04}
              clearcoat={0.35} clearcoatRoughness={0.30} />
          </mesh>
        ))}

        {/* Vänster arm */}
        <group ref={r3f(refs.lShRef)} position={[-W_SHLDR, H_TORSO * 0.87, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB * 1.05} color={color} />
          <group ref={r3f(refs.lElRef)} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.12} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.88} color={skin} />
            {/* Handled */}
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.026, 8, 6]} />
              <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>

        {/* Höger arm */}
        <group ref={r3f(refs.rShRef)} position={[W_SHLDR, H_TORSO * 0.87, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB * 1.05} color={color} />
          <group ref={r3f(refs.rElRef)} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.12} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.88} color={skin} />
            {/* Handled */}
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.026, 8, 6]} />
              <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Vänster ben */}
      <group ref={r3f(refs.lHipRef)} position={[-W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        <group ref={r3f(refs.lKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.08} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          {/* Sko – oval med sula */}
          <group position={[0, -H_SHIN - 0.01, 0]}>
            <mesh position={[0, -0.018, 0.025]} rotation={[-P * 0.18, 0, 0]} castShadow>
              <capsuleGeometry args={[0.026, 0.07, 5, 8]} />
              <meshPhysicalMaterial color="#2a2a3a" roughness={0.65} metalness={0.05} />
            </mesh>
            {/* Sula */}
            <mesh position={[0, -0.036, 0.018]} rotation={[-P * 0.18, 0, 0]} castShadow>
              <capsuleGeometry args={[0.027, 0.075, 4, 8]} />
              <meshPhysicalMaterial color="#111" roughness={0.9} metalness={0} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Höger ben */}
      <group ref={r3f(refs.rHipRef)} position={[W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        <group ref={r3f(refs.rKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.08} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          {/* Sko */}
          <group position={[0, -H_SHIN - 0.01, 0]}>
            <mesh position={[0, -0.018, 0.025]} rotation={[-P * 0.18, 0, 0]} castShadow>
              <capsuleGeometry args={[0.026, 0.07, 5, 8]} />
              <meshPhysicalMaterial color="#2a2a3a" roughness={0.65} metalness={0.05} />
            </mesh>
            <mesh position={[0, -0.036, 0.018]} rotation={[-P * 0.18, 0, 0]} castShadow>
              <capsuleGeometry args={[0.027, 0.075, 4, 8]} />
              <meshPhysicalMaterial color="#111" roughness={0.9} metalness={0} />
            </mesh>
          </group>
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

type CycleEvent = { equipmentId: string; equipmentName: string; exerciseId: string };

type Props = {
  station: Station;
  hallW: number;
  hallH: number;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  onNearEquipment: (name: string | null) => void;
  onMountedExercises: (info: MountedExerciseInfo | null) => void;
  onFreeCamChange: (on: boolean) => void;
  onExerciseCycle?: (ev: CycleEvent) => void;
  onExit: () => void;
  color?: string;
};

const TURN_SPEED = 2.5;   // rad/s
const PROX       = 1.8;   // m, monteringsradie
const CAM_DIST   = 5.5;   // m bakom gymnasten
const CAM_HEIGHT = 2.2;   // m ovanför höfterna

export function GameGymnast3D({
  station, hallW, hallH, joystickRef, mountTriggerRef, speedRef, cameraResetRef,
  onNearEquipment, onMountedExercises, onFreeCamChange, onExerciseCycle, onExit, color = "#C2185B",
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
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const onFreeCamChangeRef = useRef(onFreeCamChange);
  onFreeCamChangeRef.current = onFreeCamChange;
  const onExerciseCycleRef = useRef(onExerciseCycle);
  onExerciseCycleRef.current = onExerciseCycle;

  // Cycle-detektering: spåra senaste animationsfas per övning
  const lastCyclePhase = useRef(-1);
  const lastTrackedExerciseId = useRef("");

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
        lastCyclePhase.current = -1;
        lastTrackedExerciseId.current = "";
        onMountedExercisesRef.current(null);
        // Rensa proximity-state så etiketten försvinner
        nearEq.current = null;
        onNearEquipment(null);
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

    if (mounted.current) {
      // ── Monterad: spela övningsanimation ────────────────────────────────
      const { eqId, exerciseId, baseY: mountBaseY } = mounted.current;
      const eq = station.equipment.find(e => e.id === eqId);
      const type = eq ? getEquipmentById(eq.typeId) : null;
      const def = EXERCISES[exerciseId];
      pose = def ? evalKF(def.kfs, t) : evalKF(IDLE_KFS, t);
      if (def?.baseRotY) pose.rootRotY += def.baseRotY;

      // Detektera avslutat animationsvarv (fas-wraparound)
      if (def && def.kfs.length > 1) {
        const dur = def.kfs[def.kfs.length - 1].t;
        const phase = t % dur;
        if (exerciseId !== lastTrackedExerciseId.current) {
          // Ny övning – nollställ tracking
          lastTrackedExerciseId.current = exerciseId;
          lastCyclePhase.current = phase;
        } else if (lastCyclePhase.current > 0 && phase < lastCyclePhase.current) {
          // Fas-wraparound = ett varv klart
          const eq = station.equipment.find(e => e.id === eqId);
          const eqType = eq ? getEquipmentById(eq.typeId) : null;
          onExerciseCycleRef.current?.({
            equipmentId: eqId,
            equipmentName: eq?.label ?? eqType?.name ?? "",
            exerciseId,
          });
        }
        lastCyclePhase.current = phase;
      }

      // Advance-logik (ping-pong gång, t.ex. bom)
      if (def?.advance && def.advance > 0) {
        const dur = def.kfs[def.kfs.length - 1].t;
        const dist = (t / dur) * def.advance;
        const range = def.range ?? 3.0;
        const period = range * 2;
        const phase = dist % period;
        if (phase <= range) {
          pose.rootX += phase - range / 2;
        } else {
          pose.rootX += (period - phase) - range / 2;
          pose.rootRotY += P;
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

      // Kamera: visa gymnast + redskap — mer utzoomad
      if (eq && type) {
        const span = Math.max(type.widthM, type.heightM, type.physicalHeightM, 1.5);
        const cy = (eq.z ?? 0) + type.physicalHeightM * 0.5;
        const center = new THREE.Vector3(eq.x, cy, eq.y);
        const target = center.clone().add(new THREE.Vector3(span * 1.6, span * 1.3, span * 2.3));
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

      // Kamera bakifrån (skippa om fri kamera)
      if (!freeCamRef.current) {
        const sx = Math.sin(camYaw.current);
        const sz = -Math.cos(camYaw.current);
        const gymnPos = new THREE.Vector3(pos.current.x, baseY + 0.8, pos.current.z);
        const camTarget = gymnPos.clone().add(new THREE.Vector3(-sx * CAM_DIST, CAM_HEIGHT, -sz * CAM_DIST));
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
