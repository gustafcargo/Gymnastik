/**
 * Gymnast3D – animerad FK-figur för 3D-vyn.
 *
 * ROOT = höfter.  Bålen sträcker sig UPPÅT från ROOT; benen NEDÅT.
 * Armar hänger NEDÅT från axlarna men roteras uppåt (−π) vid häng-övningar
 * så händerna hamnar i stånggreppspunkten (physicalHeightM).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EquipmentType } from "../../types";

// ─── Proportioner (meter) ─────────────────────────────────────────────────────
const H_HEAD  = 0.09;
const H_TORSO = 0.46;
const H_UPPER = 0.27;   // överarm
const H_LOWER = 0.24;   // underarm
const H_THIGH = 0.38;
const H_SHIN  = 0.35;
const R_BODY  = 0.068;
const R_LIMB  = 0.036;
const R_LEG   = 0.046;
const W_SHLDR = 0.19;
const W_HIP   = 0.11;

// Avstånd höfter → händer (hängande, armar sträckta upp)
const HANG_DIST = H_TORSO * 0.85 + H_UPPER + H_LOWER; // ≈ 0.901 m

// ─── Pose ─────────────────────────────────────────────────────────────────────
type Pose = {
  spineX: number;
  headX:  number;
  lShX: number; lShZ: number; lElX: number;
  rShX: number; rShZ: number; rElX: number;
  lHipX: number; lKnX: number;
  rHipX: number; rKnX: number;
  rootX: number; rootY: number;
  rootRotX: number;
};

const ZERO: Pose = {
  spineX: 0, headX: 0,
  lShX: 0,  lShZ: 0,  lElX: 0,
  rShX: 0,  rShZ: 0,  rElX: 0,
  lHipX: 0, lKnX: 0,
  rHipX: 0, rKnX: 0,
  rootX: 0, rootY: 0, rootRotX: 0,
};

// Armar sträckta uppåt (−π kring X vrider "neråt-segmentet" till uppåt)
const HANG_STRAIGHT: Pose = {
  ...ZERO,
  lShX: -Math.PI, rShX: -Math.PI,
};

// ─── Keyframes ────────────────────────────────────────────────────────────────
type KF = { t: number; pose: Pose };

function lerpPose(a: Pose, b: Pose, alpha: number): Pose {
  const l = (k: keyof Pose) =>
    (a[k] as number) + ((b[k] as number) - (a[k] as number)) * alpha;
  return {
    spineX: l("spineX"), headX: l("headX"),
    lShX:  l("lShX"),  lShZ:  l("lShZ"),  lElX:  l("lElX"),
    rShX:  l("rShX"),  rShZ:  l("rShZ"),  rElX:  l("rElX"),
    lHipX: l("lHipX"), lKnX:  l("lKnX"),
    rHipX: l("rHipX"), rKnX:  l("rKnX"),
    rootX: l("rootX"), rootY: l("rootY"), rootRotX: l("rootRotX"),
  };
}

function evalKF(kfs: KF[], t: number): Pose {
  if (!kfs.length) return ZERO;
  if (kfs.length === 1) return kfs[0].pose;
  const dur = kfs[kfs.length - 1].t;
  const tn  = t % dur;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (tn >= kfs[i].t && tn < kfs[i + 1].t) {
      const a = (tn - kfs[i].t) / (kfs[i + 1].t - kfs[i].t);
      return lerpPose(kfs[i].pose, kfs[i + 1].pose, a);
    }
  }
  return kfs[kfs.length - 1].pose;
}

// ─── Animationer ──────────────────────────────────────────────────────────────
const P = Math.PI;

const EXERCISES: Record<string, KF[]> = {

  // Jättesving – ROOT cirkulerar runt stångpunkten (0, physicalHeightM, 0)
  // rootX/rootY = offset från baseY; vid α=0 hänger figuren rakt ned.
  "high-bar:giant-swing": (() => {
    const N = 20;
    return Array.from({ length: N + 1 }, (_, i) => {
      const a    = (i / N) * 2 * P;
      const bow  = Math.sin(a) * 0.13;   // ihålig/välvd kropp
      const pike = -Math.abs(Math.sin(a)) * 0.08; // lätt höftvinkel
      return {
        t: i * (1.6 / N),
        pose: {
          ...HANG_STRAIGHT,
          spineX:  bow,
          lHipX:   pike,
          rHipX:   pike,
          rootRotX: a,
          rootX:   HANG_DIST * Math.sin(a),
          rootY:   HANG_DIST * (1 - Math.cos(a)),
        } satisfies Pose,
      };
    });
  })(),

  // Kip – L-form → pull-up → stöd → häng
  "high-bar:kip": [
    { t: 0,    pose: { ...HANG_STRAIGHT } },
    { t: 0.5,  pose: { ...HANG_STRAIGHT,
        lHipX: -P*0.58, rHipX: -P*0.58,
        lKnX:   P*0.14,  rKnX:  P*0.14,
        spineX: -P*0.14, rootX: 0.14 } },
    { t: 1.2,  pose: { ...ZERO,
        lShX: P*0.13, rShX: P*0.13,
        lElX: P*0.65, rElX: P*0.65,
        lHipX: P*0.18, rHipX: P*0.18,
        spineX: P*0.1, rootY: 0.84 } },
    { t: 1.85, pose: { ...ZERO,
        lShX: P*0.04, rShX: P*0.04,
        lElX: P*0.06, rElX: P*0.06,
        rootY: 1.06 } },
    { t: 2.4,  pose: { ...HANG_STRAIGHT } },
  ],

  // Enkel sving räck
  "high-bar:swing": [
    { t: 0,   pose: { ...HANG_STRAIGHT, rootRotX:  P*0.44, lHipX:  P*0.14, rHipX:  P*0.14 } },
    { t: 0.9, pose: { ...HANG_STRAIGHT, rootRotX: -P*0.44, lHipX: -P*0.09, rHipX: -P*0.09, spineX: P*0.05 } },
    { t: 1.8, pose: { ...HANG_STRAIGHT, rootRotX:  P*0.44, lHipX:  P*0.14, rHipX:  P*0.14 } },
  ],

  // Barrsving
  "parallel-bars:swing": [
    { t: 0,   pose: { ...ZERO, lShX:-P*0.09, rShX:-P*0.09, lElX:P*0.13, rElX:P*0.13,
                      lHipX: P*0.58, rHipX: P*0.58, lKnX:-P*0.12, rKnX:-P*0.12 } },
    { t: 0.8, pose: { ...ZERO, lShX: P*0.09, rShX: P*0.09, lElX:P*0.13, rElX:P*0.13,
                      lHipX:-P*0.48, rHipX:-P*0.48, lKnX: P*0.2,  rKnX: P*0.2  } },
    { t: 1.6, pose: { ...ZERO, lShX:-P*0.09, rShX:-P*0.09, lElX:P*0.13, rElX:P*0.13,
                      lHipX: P*0.58, rHipX: P*0.58, lKnX:-P*0.12, rKnX:-P*0.12 } },
  ],

  // Stöd barr
  "parallel-bars:support": [
    { t: 0,   pose: { ...ZERO, lElX:P*0.10, rElX:P*0.10, spineX:-P*0.04, rootY:0.06 } },
    { t: 1.5, pose: { ...ZERO, lElX:P*0.07, rElX:P*0.07, spineX: P*0.03, rootY:0.09,
                      lShZ:-0.04, rShZ: 0.04 } },
    { t: 3.0, pose: { ...ZERO, lElX:P*0.10, rElX:P*0.10, spineX:-P*0.04, rootY:0.06 } },
  ],

  // Ojämna barr
  "uneven-bars:swing": [
    { t: 0,   pose: { ...HANG_STRAIGHT, rootRotX:  P*0.46, lHipX: P*0.12, rHipX: P*0.12 } },
    { t: 0.9, pose: { ...HANG_STRAIGHT, rootRotX: -P*0.46, lHipX:-P*0.08, rHipX:-P*0.08 } },
    { t: 1.8, pose: { ...HANG_STRAIGHT, rootRotX:  P*0.46, lHipX: P*0.12, rHipX: P*0.12 } },
  ],

  // Gång bom
  "beam:walk": [
    { t: 0,   pose: { ...ZERO,
        lHipX: P*0.26, lKnX:-P*0.19, rHipX:-P*0.21,
        lShX:-P*0.19,  lShZ:-0.07,   rShX: P*0.15, rShZ: 0.07 } },
    { t: 1.0, pose: { ...ZERO,
        lHipX:-P*0.21, rHipX: P*0.26, rKnX:-P*0.19,
        lShX: P*0.15,  lShZ: 0.07,    rShX:-P*0.19, rShZ:-0.07 } },
    { t: 2.0, pose: { ...ZERO,
        lHipX: P*0.26, lKnX:-P*0.19, rHipX:-P*0.21,
        lShX:-P*0.19,  lShZ:-0.07,   rShX: P*0.15, rShZ: 0.07 } },
  ],

  // Hopp bom
  "beam:jump": [
    { t: 0,    pose: { ...ZERO } },
    { t: 0.3,  pose: { ...ZERO, lHipX:-P*0.08, rHipX:-P*0.08, lKnX:P*0.12, rKnX:P*0.12, rootY:-0.05 } },
    { t: 0.65, pose: { ...ZERO, lHipX: P*0.42, rHipX: P*0.42, spineX:P*0.09, rootY:0.22,
                       lShZ:-0.22, rShZ:0.22 } },
    { t: 1.05, pose: { ...ZERO, lHipX:-P*0.07, rHipX:-P*0.07, lKnX:P*0.1, rKnX:P*0.1, rootY:-0.04 } },
    { t: 1.4,  pose: { ...ZERO } },
  ],

  // Stå (bom/plint/floor)
  "beam:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
    { t: 2.0, pose: { ...ZERO, lShZ: 0.06, rShZ:-0.06, spineX:P*0.02, rootY:0.01 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
  ],

  // Ringsving
  "rings:swing": [
    { t: 0,   pose: { ...HANG_STRAIGHT, lShZ:-0.10, rShZ: 0.10,
                      rootRotX:  P*0.34, lHipX: P*0.09, rHipX: P*0.09 } },
    { t: 0.9, pose: { ...HANG_STRAIGHT, lShZ:-0.10, rShZ: 0.10,
                      rootRotX: -P*0.34, lHipX:-P*0.07, rHipX:-P*0.07 } },
    { t: 1.8, pose: { ...HANG_STRAIGHT, lShZ:-0.10, rShZ: 0.10,
                      rootRotX:  P*0.34, lHipX: P*0.09, rHipX: P*0.09 } },
  ],

  // Kors (iron cross)
  "rings:cross": [
    { t: 0,   pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.06 } },
    { t: 2.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.10, rElX:P*0.10, rootY:0.09, spineX:P*0.02 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.06 } },
  ],

  // Handvåg
  "floor:handstand": [
    { t: 0,   pose: { ...ZERO, lShX:-P*0.97, rShX:-P*0.97, lHipX:-P*0.97, rHipX:-P*0.97,
                      spineX:-P*0.04, rootY: H_UPPER + H_LOWER - 0.04 } },
    { t: 1.5, pose: { ...ZERO, lShX:-P*0.97, rShX:-P*0.97, lHipX:-P*0.97, rHipX:-P*0.97,
                      spineX: P*0.04, rootY: H_UPPER + H_LOWER + 0.01 } },
    { t: 3.0, pose: { ...ZERO, lShX:-P*0.97, rShX:-P*0.97, lHipX:-P*0.97, rHipX:-P*0.97,
                      spineX:-P*0.04, rootY: H_UPPER + H_LOWER - 0.04 } },
  ],

  // Stå fristående
  "floor:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
    { t: 2.0, pose: { ...ZERO, spineX:P*0.02, lShZ: 0.04, rShZ:-0.04, rootY:0.01 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
  ],

  // Saxpendel bygelhäst
  "pommel-horse:scissors": [
    { t: 0,   pose: { ...ZERO, lHipX: P*0.52, rHipX:-P*0.22, lKnX:-P*0.06,
                      lShX:-P*0.08, rShX:-P*0.04, lElX:P*0.19, rElX:P*0.14, rootY:0.09 } },
    { t: 0.7, pose: { ...ZERO, lHipX:-P*0.22, rHipX: P*0.52, rKnX:-P*0.06,
                      lShX:-P*0.04, rShX:-P*0.08, lElX:P*0.14, rElX:P*0.19, rootY:0.09 } },
    { t: 1.4, pose: { ...ZERO, lHipX: P*0.52, rHipX:-P*0.22, lKnX:-P*0.06,
                      lShX:-P*0.08, rShX:-P*0.04, lElX:P*0.19, rElX:P*0.14, rootY:0.09 } },
  ],

  // Ansats hoppbord
  "vault:approach": [
    { t: 0,   pose: { ...ZERO, lHipX: P*0.38, lKnX:-P*0.22, rHipX:-P*0.16,
                      lShX:-P*0.22, rShX: P*0.16, spineX:P*0.14 } },
    { t: 1.0, pose: { ...ZERO, lHipX:-P*0.16, rHipX: P*0.38, rKnX:-P*0.22,
                      lShX: P*0.16, rShX:-P*0.22, spineX:P*0.14, rootX:0.3 } },
    { t: 2.0, pose: { ...ZERO, lHipX: P*0.38, lKnX:-P*0.22, rHipX:-P*0.16,
                      lShX:-P*0.22, rShX: P*0.16, spineX:P*0.14 } },
  ],

  // Studs trampett
  "mini-tramp:bounce": [
    { t: 0,    pose: { ...ZERO } },
    { t: 0.25, pose: { ...ZERO, lKnX:P*0.13, rKnX:P*0.13, lHipX:-P*0.07, rHipX:-P*0.07, rootY:-0.05 } },
    { t: 0.5,  pose: { ...ZERO, lHipX:P*0.19, rHipX:P*0.19, rootY:0.30, lShZ:-0.15, rShZ:0.15 } },
    { t: 0.75, pose: { ...ZERO, lKnX:P*0.13, rKnX:P*0.13, lHipX:-P*0.07, rHipX:-P*0.07, rootY:-0.05 } },
    { t: 1.0,  pose: { ...ZERO } },
  ],

  // Stå plint
  "plinth:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.08, rShZ: 0.08 } },
    { t: 2.0, pose: { ...ZERO, spineX:P*0.02, lShZ: 0.05, rShZ:-0.05, rootY:0.01 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.08, rShZ: 0.08 } },
  ],
};

// ─── Mount-typ ────────────────────────────────────────────────────────────────
type MountType = "hang-bar" | "stand-surface" | "support-bar";

function mountType(exerciseId: string): MountType {
  if (
    exerciseId.startsWith("high-bar") ||
    exerciseId.startsWith("rings") ||
    exerciseId.startsWith("uneven-bars")
  ) return "hang-bar";
  if (
    exerciseId.startsWith("parallel-bars") ||
    exerciseId.startsWith("pommel-horse")
  ) return "support-bar";
  return "stand-surface";
}

// ─── Segment (capsule) ───────────────────────────────────────────────────────
// up=true → segmentet sträcker sig uppåt från ledens origin
function Seg({
  len, r, color, up = false,
}: { len: number; r: number; color: string; up?: boolean }) {
  return (
    <mesh position={[0, up ? len / 2 : -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - r * 2), 4, 8]} />
      <meshPhysicalMaterial color={color} roughness={0.85} metalness={0} />
    </mesh>
  );
}

function Head({ color }: { color: string }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[H_HEAD, 12, 8]} />
      <meshPhysicalMaterial color={color} roughness={0.8} metalness={0} />
    </mesh>
  );
}

// ─── Huvud-komponent ─────────────────────────────────────────────────────────
type Props = {
  exerciseId: string;
  color?: string;
  equipmentType: EquipmentType;
};

export function Gymnast3D({ exerciseId, color = "#C2185B", equipmentType }: Props) {
  const SKIN = "#E8C99A";
  const kfs  = EXERCISES[exerciseId] ?? EXERCISES["floor:stand"]!;
  const mt   = mountType(exerciseId);
  const pH   = equipmentType.physicalHeightM;

  // Basposition: höfternas Y-koordinat i redskaps-lokal rymd
  const baseY = (() => {
    if (mt === "hang-bar") {
      // Händerna vid stången → höfterna HANG_DIST under stången
      return pH - HANG_DIST;
    }
    if (mt === "support-bar") {
      // Armar sträckta neråt, händer vid stångkanten, kropp ovanför
      return pH + H_UPPER + H_LOWER - H_TORSO * 0.85;
    }
    // Fötterna på ytan, höfterna en benlängd ovanför
    return pH + H_THIGH + H_SHIN;
  })();

  // Joint refs
  const rootRef  = useRef<THREE.Group>(null);
  const spineRef = useRef<THREE.Group>(null);
  const headRef  = useRef<THREE.Group>(null);
  const lShRef   = useRef<THREE.Group>(null);
  const lElRef   = useRef<THREE.Group>(null);
  const rShRef   = useRef<THREE.Group>(null);
  const rElRef   = useRef<THREE.Group>(null);
  const lHipRef  = useRef<THREE.Group>(null);
  const lKnRef   = useRef<THREE.Group>(null);
  const rHipRef  = useRef<THREE.Group>(null);
  const rKnRef   = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const p = evalKF(kfs, clock.getElapsedTime());

    if (rootRef.current) {
      rootRef.current.position.y = baseY + p.rootY;
      rootRef.current.position.x = p.rootX;
      rootRef.current.rotation.x = p.rootRotX;
    }
    if (spineRef.current) spineRef.current.rotation.x = p.spineX;
    if (headRef.current)  headRef.current.rotation.x  = p.headX;

    if (lShRef.current) { lShRef.current.rotation.x = p.lShX; lShRef.current.rotation.z = p.lShZ; }
    if (lElRef.current)   lElRef.current.rotation.x = p.lElX;
    if (rShRef.current) { rShRef.current.rotation.x = p.rShX; rShRef.current.rotation.z = p.rShZ; }
    if (rElRef.current)   rElRef.current.rotation.x = p.rElX;

    if (lHipRef.current)  lHipRef.current.rotation.x = p.lHipX;
    if (lKnRef.current)   lKnRef.current.rotation.x  = p.lKnX;
    if (rHipRef.current)  rHipRef.current.rotation.x = p.rHipX;
    if (rKnRef.current)   rKnRef.current.rotation.x  = p.rKnX;
  });

  return (
    // ROOT = höfter
    <group ref={rootRef} position={[0, baseY, 0]}>

      {/* ── Bål – sträcker sig UPPÅT från ROOT ────────────── */}
      <group ref={spineRef}>
        <Seg len={H_TORSO} r={R_BODY} color={color} up />

        {/* Huvud – ovanpå bålen */}
        <group ref={headRef} position={[0, H_TORSO + H_HEAD * 0.9, 0]}>
          <Head color={SKIN} />
        </group>

        {/* Vänster axel → armbåge → hand */}
        <group ref={lShRef} position={[-W_SHLDR, H_TORSO * 0.85, 0]}>
          <Seg len={H_UPPER} r={R_LIMB} color={color} />
          <group ref={lElRef} position={[0, -H_UPPER, 0]}>
            <Seg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} />
          </group>
        </group>

        {/* Höger axel → armbåge → hand */}
        <group ref={rShRef} position={[W_SHLDR, H_TORSO * 0.85, 0]}>
          <Seg len={H_UPPER} r={R_LIMB} color={color} />
          <group ref={rElRef} position={[0, -H_UPPER, 0]}>
            <Seg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} />
          </group>
        </group>
      </group>

      {/* ── Ben – sträcker sig NEDÅT från ROOT ────────────── */}
      <group ref={lHipRef} position={[-W_HIP, 0, 0]}>
        <Seg len={H_THIGH} r={R_LEG} color={color} />
        <group ref={lKnRef} position={[0, -H_THIGH, 0]}>
          <Seg len={H_SHIN} r={R_LEG * 0.85} color={color} />
        </group>
      </group>

      <group ref={rHipRef} position={[W_HIP, 0, 0]}>
        <Seg len={H_THIGH} r={R_LEG} color={color} />
        <group ref={rKnRef} position={[0, -H_THIGH, 0]}>
          <Seg len={H_SHIN} r={R_LEG * 0.85} color={color} />
        </group>
      </group>

    </group>
  );
}
