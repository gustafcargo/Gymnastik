/**
 * Gymnast3D – animerad stickfigur för 3D-vyn.
 *
 * Figuren byggs som ett FK-skelett (forward kinematics): varje led är en
 * <group> vars rotation styr barnens position.  useFrame interpolerar linjärt
 * mellan fördefinierade keyframes för varje övning.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EquipmentType } from "../../types";

// ─── Kropps-konstanter (meter) ────────────────────────────────────────────────
const H_HEAD   = 0.09;  // huvud-radius
const H_TORSO  = 0.46;  // bålens längd
const H_UPPER  = 0.27;  // överarm
const H_LOWER  = 0.24;  // underarm
const H_THIGH  = 0.38;  // lår
const H_SHIN   = 0.35;  // underben
const R_LIMB   = 0.038; // armradius
const R_LEG    = 0.048; // benradius
const W_SHLDR  = 0.19;  // halvt axelbredd
const W_HIP    = 0.11;  // halvt höftbredd

// ─── Pose-typ ────────────────────────────────────────────────────────────────
type Pose = {
  // Rotation kring X (böj framåt = +), Z (åt sidan = +)
  spineX: number;
  headX: number;
  lShX: number; lShZ: number; lElX: number; // vänster axel / armbåge
  rShX: number; rShZ: number; rElX: number; // höger axel / armbåge
  lHipX: number; lKnX: number;              // vänster höft / knä
  rHipX: number; rKnX: number;              // höger höft / knä
  rootX: number; rootY: number;             // extra förskjutning i meter
  rootRotX: number;                         // extra rotation av hela figuren
};

const ZERO: Pose = {
  spineX:0, headX:0,
  lShX:0, lShZ:0, lElX:0,
  rShX:0, rShZ:0, rElX:0,
  lHipX:0, lKnX:0,
  rHipX:0, rKnX:0,
  rootX:0, rootY:0, rootRotX:0,
};

// ─── Keyframe-hjälpare ────────────────────────────────────────────────────────
type KF = { t: number; pose: Pose };

function lerpPose(a: Pose, b: Pose, alpha: number): Pose {
  const l = (k: keyof Pose) => (a[k] as number) + ((b[k] as number) - (a[k] as number)) * alpha;
  return {
    spineX: l("spineX"), headX: l("headX"),
    lShX: l("lShX"), lShZ: l("lShZ"), lElX: l("lElX"),
    rShX: l("rShX"), rShZ: l("rShZ"), rElX: l("rElX"),
    lHipX: l("lHipX"), lKnX: l("lKnX"),
    rHipX: l("rHipX"), rKnX: l("rKnX"),
    rootX: l("rootX"), rootY: l("rootY"), rootRotX: l("rootRotX"),
  };
}

function evalKeyframes(kfs: KF[], t: number): Pose {
  if (kfs.length === 0) return ZERO;
  if (kfs.length === 1) return kfs[0].pose;
  const last = kfs[kfs.length - 1];
  const tn = t % last.t;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (tn >= kfs[i].t && tn < kfs[i + 1].t) {
      const alpha = (tn - kfs[i].t) / (kfs[i + 1].t - kfs[i].t);
      return lerpPose(kfs[i].pose, kfs[i + 1].pose, alpha);
    }
  }
  return last.pose;
}

// ─── Övnings-animationer ──────────────────────────────────────────────────────
const P = Math.PI;

// Hjälp: rak kropp hängande med armarna ovan huvud
const HANG_STRAIGHT: Pose = {
  ...ZERO,
  lShX: -P*0.9, lShZ: W_SHLDR*0, lElX: 0,
  rShX: -P*0.9, rShZ: 0, rElX: 0,
  rootRotX: 0,
};

const EXERCISES: Record<string, KF[]> = {

  // ── Kast bakåt (jättesving på räck) – figuren snurrar ett varv runt stången
  "high-bar:giant-swing": (() => {
    const R = H_TORSO / 2 + H_THIGH + H_SHIN + 0.1; // radius från stång till fötter
    const frames: KF[] = [];
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const angle = (i / N) * P * 2;
      // rootRotX styr figuren runt stångens axel
      frames.push({ t: i * (1.6 / N), pose: {
        ...HANG_STRAIGHT,
        rootRotX: angle,
        rootY: -R * Math.cos(angle),
        rootX:  R * Math.sin(angle),
      }});
    }
    return frames;
  })(),

  // ── Kip – svinga upp till stöd
  "high-bar:kip": [
    { t: 0,   pose: { ...HANG_STRAIGHT } },
    // Glid: höfter framåt, kroppen i L
    { t: 0.6, pose: { ...HANG_STRAIGHT, lHipX: -P*0.5, rHipX: -P*0.5, lKnX: 0, rKnX: 0, spineX: -P*0.3 } },
    // Pull-up: armar böjer, kropp stiger
    { t: 1.4, pose: { ...ZERO, lShX: P*0.1, lElX: P*0.6, rShX: P*0.1, rElX: P*0.6, lHipX: P*0.2, rHipX: P*0.2, rootY: 1.0 } },
    // Stöd ovan stång
    { t: 1.9, pose: { ...ZERO, lShX: P*0.05, rShX: P*0.05, lHipX: P*0.05, rHipX: P*0.05, rootY: 1.15 } },
    // Tillbaka till hängande
    { t: 2.4, pose: { ...HANG_STRAIGHT } },
  ],

  // ── Enkel sving på räck
  "high-bar:swing": [
    { t: 0,   pose: { ...HANG_STRAIGHT, rootRotX:  P*0.35 } },
    { t: 0.9, pose: { ...HANG_STRAIGHT, rootRotX: -P*0.35 } },
    { t: 1.8, pose: { ...HANG_STRAIGHT, rootRotX:  P*0.35 } },
  ],

  // ── Sving på barr
  "parallel-bars:swing": [
    { t: 0,   pose: { ...ZERO, lShX:-P*0.1, rShX:-P*0.1, lElX:P*0.1, rElX:P*0.1,
                      lHipX: P*0.5, rHipX: P*0.5, lKnX:-P*0.1, rKnX:-P*0.1, rootY:0.02 } },
    { t: 0.8, pose: { ...ZERO, lShX: P*0.1, rShX: P*0.1, lElX:P*0.1, rElX:P*0.1,
                      lHipX:-P*0.4, rHipX:-P*0.4, lKnX: P*0.2, rKnX: P*0.2, rootY:0.05 } },
    { t: 1.6, pose: { ...ZERO, lShX:-P*0.1, rShX:-P*0.1, lElX:P*0.1, rElX:P*0.1,
                      lHipX: P*0.5, rHipX: P*0.5, lKnX:-P*0.1, rKnX:-P*0.1, rootY:0.02 } },
  ],

  // ── Stöd (statisk stans) på barr
  "parallel-bars:support": [
    { t: 0,   pose: { ...ZERO, lElX:P*0.12, rElX:P*0.12, spineX:-P*0.05, rootY:0.05 } },
    { t: 1.5, pose: { ...ZERO, lElX:P*0.08, rElX:P*0.08, spineX: P*0.05, rootY:0.08 } },
    { t: 3.0, pose: { ...ZERO, lElX:P*0.12, rElX:P*0.12, spineX:-P*0.05, rootY:0.05 } },
  ],

  // ── Ojämna barr sving
  "uneven-bars:swing": [
    { t: 0,   pose: { ...HANG_STRAIGHT, rootRotX:  P*0.4 } },
    { t: 0.9, pose: { ...HANG_STRAIGHT, rootRotX: -P*0.4, lHipX:-P*0.1, rHipX:-P*0.1 } },
    { t: 1.8, pose: { ...HANG_STRAIGHT, rootRotX:  P*0.4 } },
  ],

  // ── Gång på bom
  "beam:walk": [
    { t: 0,   pose: { ...ZERO, lHipX: P*0.22, lKnX:-P*0.15, rHipX:-P*0.18,
                      lShX:-P*0.15, lShZ:-0.05, rShX: P*0.12, rShZ: 0.05 } },
    { t: 1.0, pose: { ...ZERO, lHipX:-P*0.18, rHipX: P*0.22, rKnX:-P*0.15,
                      lShX: P*0.12, lShZ: 0.05, rShX:-P*0.15, rShZ:-0.05 } },
    { t: 2.0, pose: { ...ZERO, lHipX: P*0.22, lKnX:-P*0.15, rHipX:-P*0.18,
                      lShX:-P*0.15, lShZ:-0.05, rShX: P*0.12, rShZ: 0.05 } },
  ],

  // ── Hopp på bom
  "beam:jump": [
    { t: 0,   pose: { ...ZERO } },
    { t: 0.3, pose: { ...ZERO, lHipX:-P*0.1, rHipX:-P*0.1, spineX:-P*0.05, rootY:-0.04 } },
    { t: 0.7, pose: { ...ZERO, lHipX: P*0.35, rHipX: P*0.35, spineX: P*0.1, rootY: 0.22,
                      lShZ:-0.18, rShZ: 0.18 } },
    { t: 1.1, pose: { ...ZERO, lHipX:-P*0.05, rHipX:-P*0.05, rootY:-0.03 } },
    { t: 1.4, pose: { ...ZERO } },
  ],

  // ── Stå stilla (bom / fristående / plint)
  "beam:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06 } },
    { t: 2.0, pose: { ...ZERO, lShZ: 0.05, rShZ:-0.05, spineX: P*0.02 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06 } },
  ],

  // ── Ringsving
  "rings:swing": [
    { t: 0,   pose: { ...HANG_STRAIGHT, lShZ:-0.08, rShZ: 0.08, rootRotX:  P*0.3 } },
    { t: 0.9, pose: { ...HANG_STRAIGHT, lShZ:-0.08, rShZ: 0.08, rootRotX: -P*0.3 } },
    { t: 1.8, pose: { ...HANG_STRAIGHT, lShZ:-0.08, rShZ: 0.08, rootRotX:  P*0.3 } },
  ],

  // ── Kors (statisk) på ringar
  "rings:cross": [
    { t: 0,   pose: { ...ZERO, lShX:0, lShZ:-P*0.45, rShX:0, rShZ: P*0.45,
                      lElX:P*0.05, rElX:P*0.05, rootY: 0.05 } },
    { t: 2.0, pose: { ...ZERO, lShX:0, lShZ:-P*0.45, rShX:0, rShZ: P*0.45,
                      lElX:P*0.08, rElX:P*0.08, rootY: 0.07 } },
    { t: 4.0, pose: { ...ZERO, lShX:0, lShZ:-P*0.45, rShX:0, rShZ: P*0.45,
                      lElX:P*0.05, rElX:P*0.05, rootY: 0.05 } },
  ],

  // ── Handvåg (fristående)
  "floor:handstand": [
    { t: 0,   pose: { ...ZERO, lShX:-P*0.95, rShX:-P*0.95,
                      lHipX:-P*0.95, rHipX:-P*0.95, spineX:-P*0.05,
                      rootY: H_UPPER + H_LOWER - 0.05 } },
    { t: 1.5, pose: { ...ZERO, lShX:-P*0.95, rShX:-P*0.95,
                      lHipX:-P*0.95, rHipX:-P*0.95, spineX: P*0.04,
                      rootY: H_UPPER + H_LOWER } },
    { t: 3.0, pose: { ...ZERO, lShX:-P*0.95, rShX:-P*0.95,
                      lHipX:-P*0.95, rHipX:-P*0.95, spineX:-P*0.05,
                      rootY: H_UPPER + H_LOWER - 0.05 } },
  ],

  // ── Stå stilla (fristående)
  "floor:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06 } },
    { t: 2.0, pose: { ...ZERO, spineX: P*0.02 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06 } },
  ],

  // ── Saxpendel (bygelhäst)
  "pommel-horse:scissors": [
    { t: 0,   pose: { ...ZERO, lHipX: P*0.45, rHipX:-P*0.2, lKnX:-P*0.05, rootY:0.08,
                      lShX:-P*0.1, rShX:-P*0.05, lElX:P*0.2, rElX:P*0.15 } },
    { t: 0.7, pose: { ...ZERO, lHipX:-P*0.2, rHipX: P*0.45, rKnX:-P*0.05, rootY:0.08,
                      lShX:-P*0.05, rShX:-P*0.1, lElX:P*0.15, rElX:P*0.2 } },
    { t: 1.4, pose: { ...ZERO, lHipX: P*0.45, rHipX:-P*0.2, lKnX:-P*0.05, rootY:0.08,
                      lShX:-P*0.1, rShX:-P*0.05, lElX:P*0.2, rElX:P*0.15 } },
  ],

  // ── Ansats (hoppbord)
  "vault:approach": [
    { t: 0,   pose: { ...ZERO, lHipX: P*0.35, lKnX:-P*0.2, rHipX:-P*0.15,
                      lShX:-P*0.2, rShX: P*0.15, spineX: P*0.12, rootX: 0 } },
    { t: 1.0, pose: { ...ZERO, lHipX:-P*0.15, rHipX: P*0.35, rKnX:-P*0.2,
                      lShX: P*0.15, rShX:-P*0.2, spineX: P*0.12, rootX: 0.3 } },
    { t: 2.0, pose: { ...ZERO, lHipX: P*0.35, lKnX:-P*0.2, rHipX:-P*0.15,
                      lShX:-P*0.2, rShX: P*0.15, spineX: P*0.12, rootX: 0 } },
  ],

  // ── Studs (trampett)
  "mini-tramp:bounce": [
    { t: 0,   pose: { ...ZERO } },
    { t: 0.25, pose: { ...ZERO, lHipX:-P*0.06, rHipX:-P*0.06, lKnX: P*0.1, rKnX: P*0.1, rootY:-0.04 } },
    { t: 0.5, pose: { ...ZERO, lHipX: P*0.15, rHipX: P*0.15, rootY: 0.28,
                      lShZ:-0.12, rShZ: 0.12 } },
    { t: 0.75, pose: { ...ZERO, lHipX:-P*0.06, rHipX:-P*0.06, lKnX: P*0.1, rKnX: P*0.1, rootY:-0.04 } },
    { t: 1.0, pose: { ...ZERO } },
  ],

  // ── Stå på plint/bock
  "plinth:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
    { t: 2.0, pose: { ...ZERO, spineX: P*0.02, lShZ: 0.04, rShZ:-0.04 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
  ],
};

// ─── Monterings-konfiguration per övning ─────────────────────────────────────
// Var på redskapet figuren fäster, och typ av fäste.
type MountType = "hang-bar" | "stand-surface" | "support-bar";
type MountCfg = {
  type: MountType;
  offsetY: number; // Y-förskjutning relativt redskapets top (meter)
};

function mountForExercise(exerciseId: string, eqType: EquipmentType): MountCfg {
  if (exerciseId.startsWith("high-bar") || exerciseId.startsWith("rings")) {
    return { type: "hang-bar", offsetY: 0 };
  }
  if (exerciseId.startsWith("parallel-bars")) {
    return { type: "support-bar", offsetY: 0 };
  }
  if (exerciseId.startsWith("vault:approach")) {
    return { type: "stand-surface", offsetY: -eqType.physicalHeightM * 0.5 };
  }
  return { type: "stand-surface", offsetY: 0 };
}

// ─── Segment-hjälpare ────────────────────────────────────────────────────────
function Seg({
  len, r, color, skinColor,
}: { len: number; r: number; color: string; skinColor: string }) {
  // Cylindern sträcker sig NEDÅT från leds-origin (negativ Y).
  const isSkin = color === skinColor;
  return (
    <mesh position={[0, -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, len - r * 2, 4, 8]} />
      <meshPhysicalMaterial color={isSkin ? skinColor : color} roughness={0.85} metalness={0} />
    </mesh>
  );
}

// ─── Huvud ───────────────────────────────────────────────────────────────────
function Head({ skinColor }: { skinColor: string }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[H_HEAD, 12, 8]} />
      <meshPhysicalMaterial color={skinColor} roughness={0.8} metalness={0} />
    </mesh>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  exerciseId: string;
  color?: string;
  equipmentType: EquipmentType;
};

// ─── Huvud-komponent ─────────────────────────────────────────────────────────
export function Gymnast3D({ exerciseId, color = "#C2185B", equipmentType }: Props) {
  const SKIN = "#E8C99A";
  const kfs  = EXERCISES[exerciseId] ?? EXERCISES["floor:stand"] ?? [];

  // Joint refs
  const rootRef   = useRef<THREE.Group>(null);
  const spineRef  = useRef<THREE.Group>(null);
  const headRef   = useRef<THREE.Group>(null);
  const lShRef    = useRef<THREE.Group>(null);
  const lElRef    = useRef<THREE.Group>(null);
  const rShRef    = useRef<THREE.Group>(null);
  const rElRef    = useRef<THREE.Group>(null);
  const lHipRef   = useRef<THREE.Group>(null);
  const lKnRef    = useRef<THREE.Group>(null);
  const rHipRef   = useRef<THREE.Group>(null);
  const rKnRef    = useRef<THREE.Group>(null);

  const mount = mountForExercise(exerciseId, equipmentType);

  // Beräkna monterings-offset så figuren sitter rätt på redskapet
  const baseY = (() => {
    if (mount.type === "hang-bar") {
      // Händerna i toppen → kroppen hänger nedåt
      return equipmentType.physicalHeightM + mount.offsetY;
    }
    if (mount.type === "support-bar") {
      return equipmentType.physicalHeightM - 0.05 + mount.offsetY;
    }
    // stand-surface: fötterna på ytan
    return equipmentType.physicalHeightM + mount.offsetY;
  })();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pose = evalKeyframes(kfs, t);

    if (rootRef.current) {
      rootRef.current.position.y  = baseY + pose.rootY;
      rootRef.current.position.x  = pose.rootX;
      rootRef.current.rotation.x  = pose.rootRotX;
    }
    if (spineRef.current) spineRef.current.rotation.x = pose.spineX;
    if (headRef.current)  headRef.current.rotation.x  = pose.headX;

    if (lShRef.current) { lShRef.current.rotation.x = pose.lShX; lShRef.current.rotation.z = pose.lShZ; }
    if (lElRef.current)   lElRef.current.rotation.x = pose.lElX;
    if (rShRef.current) { rShRef.current.rotation.x = pose.rShX; rShRef.current.rotation.z = pose.rShZ; }
    if (rElRef.current)   rElRef.current.rotation.x = pose.rElX;

    if (lHipRef.current) lHipRef.current.rotation.x = pose.lHipX;
    if (lKnRef.current)  lKnRef.current.rotation.x  = pose.lKnX;
    if (rHipRef.current) rHipRef.current.rotation.x = pose.rHipX;
    if (rKnRef.current)  rKnRef.current.rotation.x  = pose.rKnX;
  });

  return (
    // ROOT = höfter
    <group ref={rootRef} position={[0, baseY, 0]}>

      {/* ── Bål ──────────────────────────────────────── */}
      <group ref={spineRef}>
        <Seg len={H_TORSO} r={0.07} color={color} skinColor={SKIN} />

        {/* Huvud */}
        <group ref={headRef} position={[0, H_TORSO * 0.92, 0]}>
          <Head skinColor={SKIN} />
        </group>

        {/* Vänster axel → underarm */}
        <group ref={lShRef} position={[-W_SHLDR, H_TORSO * 0.82, 0]}>
          <Seg len={H_UPPER} r={R_LIMB} color={color} skinColor={SKIN} />
          <group ref={lElRef} position={[0, -H_UPPER, 0]}>
            <Seg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} skinColor={SKIN} />
          </group>
        </group>

        {/* Höger axel → underarm */}
        <group ref={rShRef} position={[W_SHLDR, H_TORSO * 0.82, 0]}>
          <Seg len={H_UPPER} r={R_LIMB} color={color} skinColor={SKIN} />
          <group ref={rElRef} position={[0, -H_UPPER, 0]}>
            <Seg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} skinColor={SKIN} />
          </group>
        </group>
      </group>

      {/* ── Ben ──────────────────────────────────────── */}
      {/* Vänster höft → knä */}
      <group ref={lHipRef} position={[-W_HIP, 0, 0]}>
        <Seg len={H_THIGH} r={R_LEG} color={color} skinColor={SKIN} />
        <group ref={lKnRef} position={[0, -H_THIGH, 0]}>
          <Seg len={H_SHIN} r={R_LEG * 0.85} color={color} skinColor={SKIN} />
        </group>
      </group>

      {/* Höger höft → knä */}
      <group ref={rHipRef} position={[W_HIP, 0, 0]}>
        <Seg len={H_THIGH} r={R_LEG} color={color} skinColor={SKIN} />
        <group ref={rKnRef} position={[0, -H_THIGH, 0]}>
          <Seg len={H_SHIN} r={R_LEG * 0.85} color={color} skinColor={SKIN} />
        </group>
      </group>

    </group>
  );
}
