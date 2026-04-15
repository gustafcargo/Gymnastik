/**
 * Gymnast3D – animerad FK-figur för 3D-vyn.
 *
 * ROOT = höfter.  Bålen sträcker sig UPPÅT; benen NEDÅT.
 * Häng-övningar: händerna låsta vid stången via pendel-förskjutning
 * (rootZ + rootY) som matchar rootRotX, så pivot är i greppspunkten.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EquipmentType } from "../../types";

// ─── Proportioner (meter) ─────────────────────────────────────────────────────
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

// Avstånd höfter → händer (armar sträckta rakt upp)
const HANG_DIST = H_TORSO * 0.85 + H_UPPER + H_LOWER; // ≈ 0.901 m

// ─── Pose ─────────────────────────────────────────────────────────────────────
type Pose = {
  spineX: number;
  headX:  number;
  lShX: number; lShZ: number; lElX: number;
  rShX: number; rShZ: number; rElX: number;
  lHipX: number; lKnX: number;
  rHipX: number; rKnX: number;
  rootX: number; rootY: number; rootZ: number;
  rootRotX: number; rootRotY: number;
};

const ZERO: Pose = {
  spineX: 0, headX: 0,
  lShX: 0,  lShZ: 0,  lElX: 0,
  rShX: 0,  rShZ: 0,  rElX: 0,
  lHipX: 0, lKnX: 0,
  rHipX: 0, rKnX: 0,
  rootX: 0, rootY: 0, rootZ: 0,
  rootRotX: 0, rootRotY: 0,
};

// Armar sträckta uppåt (−π vrider neråt-segmentet till uppåt)
const HANG_STRAIGHT: Pose = { ...ZERO, lShX: -Math.PI, rShX: -Math.PI };

// ─── Keyframe-hjälpare ────────────────────────────────────────────────────────
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
    rootX: l("rootX"), rootY: l("rootY"), rootZ: l("rootZ"),
    rootRotX: l("rootRotX"), rootRotY: l("rootRotY"),
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

// Pendel-förskjutning: håller händerna vid stången vid vinkel a
function pend(a: number) {
  return {
    rootZ: HANG_DIST * Math.sin(a),
    rootY: HANG_DIST * (1 - Math.cos(a)),
  };
}

// ─── Animationer ──────────────────────────────────────────────────────────────
const P = Math.PI;

const EXERCISES: Record<string, KF[]> = {

  // Jättesving – ROOT cirkulerar runt stången i YZ-planet
  "high-bar:giant-swing": (() => {
    const N = 20;
    return Array.from({ length: N + 1 }, (_, i) => {
      const a   = (i / N) * 2 * P;
      const bow = Math.sin(a) * 0.14;
      return {
        t: i * (1.6 / N),
        pose: {
          ...HANG_STRAIGHT,
          spineX: bow,
          lHipX: -Math.abs(Math.sin(a)) * 0.09,
          rHipX: -Math.abs(Math.sin(a)) * 0.09,
          rootRotX: a,
          rootZ: HANG_DIST * Math.sin(a),
          rootY: HANG_DIST * (1 - Math.cos(a)),
        } satisfies Pose,
      };
    });
  })(),

  // Kip – L-form → pull-up → stöd → häng
  "high-bar:kip": [
    { t: 0,    pose: { ...HANG_STRAIGHT } },
    { t: 0.50, pose: { ...HANG_STRAIGHT,
        lHipX: -P*0.58, rHipX: -P*0.58,
        lKnX:   P*0.14, rKnX:   P*0.14,
        spineX: -P*0.14,
        ...pend(0), rootX: 0.14 } },
    { t: 1.20, pose: { ...ZERO,
        lShX: P*0.13, rShX: P*0.13,
        lElX: P*0.65, rElX: P*0.65,
        lHipX: P*0.18, rHipX: P*0.18,
        spineX: P*0.10, rootY: 0.84 } },
    { t: 1.85, pose: { ...ZERO,
        lShX: P*0.04, rShX: P*0.04,
        lElX: P*0.06, rElX: P*0.06,
        rootY: 1.06 } },
    { t: 2.40, pose: { ...HANG_STRAIGHT } },
  ],

  // Enkel sving räck – pendel från händerna
  "high-bar:swing": (() => {
    const a = P * 0.30;
    const fwd = { ...HANG_STRAIGHT, rootRotX:  a, lHipX:  P*0.1,  rHipX:  P*0.1,  spineX: -P*0.04, ...pend( a) };
    const bak = { ...HANG_STRAIGHT, rootRotX: -a, lHipX: -P*0.08, rHipX: -P*0.08, spineX:  P*0.05, ...pend(-a) };
    return [
      { t: 0.0, pose: fwd },
      { t: 0.9, pose: bak },
      { t: 1.8, pose: fwd },
    ];
  })(),

  // Barrsving
  "parallel-bars:swing": [
    { t: 0,   pose: { ...ZERO, lShX:-P*0.09, rShX:-P*0.09, lElX:P*0.12, rElX:P*0.12,
                      lHipX: P*0.58, rHipX: P*0.58, lKnX:-P*0.12, rKnX:-P*0.12 } },
    { t: 0.8, pose: { ...ZERO, lShX: P*0.09, rShX: P*0.09, lElX:P*0.12, rElX:P*0.12,
                      lHipX:-P*0.48, rHipX:-P*0.48, lKnX: P*0.20, rKnX: P*0.20 } },
    { t: 1.6, pose: { ...ZERO, lShX:-P*0.09, rShX:-P*0.09, lElX:P*0.12, rElX:P*0.12,
                      lHipX: P*0.58, rHipX: P*0.58, lKnX:-P*0.12, rKnX:-P*0.12 } },
  ],

  // Stöd barr – händerna vid stånghöjd, kropp ovanför
  "parallel-bars:support": [
    { t: 0,   pose: { ...ZERO, lElX:P*0.10, rElX:P*0.10, spineX:-P*0.04 } },
    { t: 1.5, pose: { ...ZERO, lElX:P*0.07, rElX:P*0.07, spineX: P*0.03, rootY:0.03,
                      lShZ:-0.04, rShZ: 0.04 } },
    { t: 3.0, pose: { ...ZERO, lElX:P*0.10, rElX:P*0.10, spineX:-P*0.04 } },
  ],

  // Ojämna barr – pendel från händerna
  "uneven-bars:swing": (() => {
    const a = P * 0.28;
    const fwd = { ...HANG_STRAIGHT, rootRotX:  a, lHipX:  P*0.10, rHipX:  P*0.10, ...pend( a) };
    const bak = { ...HANG_STRAIGHT, rootRotX: -a, lHipX: -P*0.07, rHipX: -P*0.07, ...pend(-a) };
    return [
      { t: 0.0, pose: fwd },
      { t: 0.9, pose: bak },
      { t: 1.8, pose: fwd },
    ];
  })(),

  // Gång bom
  "beam:walk": [
    { t: 0,   pose: { ...ZERO,
        lHipX: P*0.26, lKnX:-P*0.18, rHipX:-P*0.20,
        lShX:-P*0.18, lShZ:-0.07, rShX: P*0.14, rShZ: 0.07 } },
    { t: 1.0, pose: { ...ZERO,
        lHipX:-P*0.20, rHipX: P*0.26, rKnX:-P*0.18,
        lShX: P*0.14, lShZ: 0.07, rShX:-P*0.18, rShZ:-0.07 } },
    { t: 2.0, pose: { ...ZERO,
        lHipX: P*0.26, lKnX:-P*0.18, rHipX:-P*0.20,
        lShX:-P*0.18, lShZ:-0.07, rShX: P*0.14, rShZ: 0.07 } },
  ],

  // Hopp bom
  "beam:jump": [
    { t: 0,    pose: { ...ZERO } },
    { t: 0.30, pose: { ...ZERO, lHipX:-P*0.08, rHipX:-P*0.08, lKnX:P*0.12, rKnX:P*0.12, rootY:-0.05 } },
    { t: 0.65, pose: { ...ZERO, lHipX: P*0.42, rHipX: P*0.42, spineX:P*0.09, rootY:0.22,
                       lShZ:-0.22, rShZ:0.22 } },
    { t: 1.05, pose: { ...ZERO, lHipX:-P*0.07, rHipX:-P*0.07, lKnX:P*0.10, rKnX:P*0.10, rootY:-0.04 } },
    { t: 1.40, pose: { ...ZERO } },
  ],

  // Stå (bom/plint/floor)
  "beam:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
    { t: 2.0, pose: { ...ZERO, lShZ: 0.06, rShZ:-0.06, spineX:P*0.02, rootY:0.01 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
  ],

  // Arabesque – vänster ben bak, höger stödbenet
  "beam:arabesque": [
    { t: 0,   pose: { ...ZERO } },
    { t: 0.70, pose: { ...ZERO,
        lHipX: -P*0.50, lKnX: P*0.04,
        rHipX:  P*0.04, rKnX:-P*0.03,
        spineX: -P*0.08,
        lShX: P*0.65, lElX: P*0.10,
        rShZ: P*0.42, rShX:-P*0.04, rElX: P*0.06,
        rootY: 0.01 } },
    { t: 2.80, pose: { ...ZERO,
        lHipX: -P*0.52, lKnX: P*0.04,
        rHipX:  P*0.04, rKnX:-P*0.03,
        spineX: -P*0.07,
        lShX: P*0.67, lElX: P*0.10,
        rShZ: P*0.40, rShX:-P*0.04, rElX: P*0.06,
        rootY: 0.01 } },
    { t: 3.50, pose: { ...ZERO } },
  ],

  // Knähopp (tuck jump)
  "beam:tuck-jump": [
    { t: 0,    pose: { ...ZERO } },
    { t: 0.28, pose: { ...ZERO, lKnX:P*0.12, rKnX:P*0.12, lHipX:-P*0.07, rHipX:-P*0.07, rootY:-0.06 } },
    { t: 0.62, pose: { ...ZERO, lHipX:P*0.68, rHipX:P*0.68, lKnX:-P*0.52, rKnX:-P*0.52,
                       spineX:P*0.06, rootY:0.34, lShZ:-0.24, rShZ:0.24 } },
    { t: 0.98, pose: { ...ZERO, lHipX:-P*0.07, rHipX:-P*0.07, lKnX:P*0.10, rKnX:P*0.10, rootY:-0.05 } },
    { t: 1.40, pose: { ...ZERO } },
  ],

  // Pirouette – en hel 360° rotation
  "beam:pirouette": [
    { t: 0,   pose: { ...ZERO, rootRotY: 0 } },
    { t: 0.30, pose: { ...ZERO, rootY:0.05, rootRotY: P*0.4,
                       lShZ:-0.14, rShZ:0.14, lHipX:P*0.04, rKnX:-P*0.06 } },
    { t: 1.10, pose: { ...ZERO, rootY:0.06, rootRotY: P,
                       lShZ:-0.10, rShZ:0.10 } },
    { t: 1.80, pose: { ...ZERO, rootY:0.05, rootRotY: P*1.6,
                       lShZ:-0.08, rShZ:0.08 } },
    { t: 2.30, pose: { ...ZERO, rootY:0.02, rootRotY: P*2 } },
    { t: 2.50, pose: { ...ZERO, rootRotY: P*2 } },
  ],

  // Stegserie 1 – sekvens: gång → arabesque → knähopp → pirouette
  "beam:stegserie-1": [
    // Stå
    { t: 0,   pose: { ...ZERO } },
    // Steg 1
    { t: 0.55, pose: { ...ZERO,
        lHipX: P*0.25, lKnX:-P*0.17, rHipX:-P*0.19,
        lShX:-P*0.17, lShZ:-0.06, rShX: P*0.13, rShZ: 0.06 } },
    // Steg 2
    { t: 1.10, pose: { ...ZERO,
        lHipX:-P*0.19, rHipX: P*0.25, rKnX:-P*0.17,
        lShX: P*0.13, lShZ: 0.06, rShX:-P*0.17, rShZ:-0.06 } },
    // Transition arabesque
    { t: 1.65, pose: { ...ZERO } },
    // Arabesque
    { t: 2.30, pose: { ...ZERO,
        lHipX:-P*0.50, lKnX:P*0.04, rHipX:P*0.04, rKnX:-P*0.03,
        spineX:-P*0.08, lShX:P*0.65, lElX:P*0.10,
        rShZ:P*0.42, rShX:-P*0.04, rootY:0.01 } },
    { t: 3.80, pose: { ...ZERO,
        lHipX:-P*0.52, lKnX:P*0.04, rHipX:P*0.04,
        spineX:-P*0.07, lShX:P*0.67, lElX:P*0.10,
        rShZ:P*0.40, rootY:0.01 } },
    // Lägger ner ben
    { t: 4.30, pose: { ...ZERO } },
    // Knähopp – förberedelse
    { t: 4.60, pose: { ...ZERO, lKnX:P*0.12, rKnX:P*0.12, lHipX:-P*0.08, rHipX:-P*0.08, rootY:-0.06 } },
    // Luft
    { t: 4.95, pose: { ...ZERO, lHipX:P*0.68, rHipX:P*0.68, lKnX:-P*0.52, rKnX:-P*0.52,
                       spineX:P*0.06, rootY:0.34, lShZ:-0.24, rShZ:0.24 } },
    // Landning
    { t: 5.35, pose: { ...ZERO, lHipX:-P*0.07, rHipX:-P*0.07, lKnX:P*0.10, rKnX:P*0.10, rootY:-0.05 } },
    { t: 5.80, pose: { ...ZERO } },
    // Pirouette
    { t: 6.20, pose: { ...ZERO, rootY:0.05, rootRotY:P*0.4, lShZ:-0.13, rShZ:0.13 } },
    { t: 7.00, pose: { ...ZERO, rootY:0.06, rootRotY:P, lShZ:-0.09, rShZ:0.09 } },
    { t: 7.70, pose: { ...ZERO, rootY:0.05, rootRotY:P*1.6 } },
    { t: 8.20, pose: { ...ZERO, rootY:0.02, rootRotY:P*2 } },
    // Avslut
    { t: 8.60, pose: { ...ZERO, rootRotY:P*2 } },
    { t: 9.00, pose: { ...ZERO, rootRotY:P*2 } },
  ],

  // Ringsving – pendel
  "rings:swing": (() => {
    const a = P * 0.26;
    const fwd = { ...HANG_STRAIGHT, lShZ:-0.10, rShZ:0.10, rootRotX: a, lHipX: P*0.08, rHipX: P*0.08, ...pend( a) };
    const bak = { ...HANG_STRAIGHT, lShZ:-0.10, rShZ:0.10, rootRotX:-a, lHipX:-P*0.06, rHipX:-P*0.06, ...pend(-a) };
    return [
      { t: 0.0, pose: fwd },
      { t: 0.9, pose: bak },
      { t: 1.8, pose: fwd },
    ];
  })(),

  // Kors (iron cross)
  "rings:cross": [
    { t: 0,   pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.06 } },
    { t: 2.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.10, rElX:P*0.10, rootY:0.09, spineX:P*0.02 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.06 } },
  ],

  // Handvåg – kropp inverterad, händer mot golvet
  "floor:handstand": [
    { t: 0,   pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.17, spineX: -P*0.04 } },
    { t: 1.5, pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.19, spineX: P*0.04, headX: P*0.05 } },
    { t: 3.0, pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.17, spineX: -P*0.04 } },
  ],

  // Stå fristående
  "floor:stand": [
    { t: 0,   pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
    { t: 2.0, pose: { ...ZERO, spineX:P*0.02, lShZ: 0.04, rShZ:-0.04, rootY:0.01 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.07, rShZ: 0.07 } },
  ],

  // Saxpendel bygelhäst
  "pommel-horse:scissors": [
    { t: 0,   pose: { ...ZERO,
        lHipX: P*0.52, rHipX:-P*0.22, lKnX:-P*0.06,
        lShX:-P*0.08, rShX:-P*0.04, lElX:P*0.19, rElX:P*0.14, rootY:0.09 } },
    { t: 0.7, pose: { ...ZERO,
        lHipX:-P*0.22, rHipX: P*0.52, rKnX:-P*0.06,
        lShX:-P*0.04, rShX:-P*0.08, lElX:P*0.14, rElX:P*0.19, rootY:0.09 } },
    { t: 1.4, pose: { ...ZERO,
        lHipX: P*0.52, rHipX:-P*0.22, lKnX:-P*0.06,
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

// ─── Primitiver ───────────────────────────────────────────────────────────────
// Segment: up=true → sträcker sig uppåt, annars nedåt
function Seg({ len, r, color, up = false }: { len: number; r: number; color: string; up?: boolean }) {
  return (
    <mesh position={[0, up ? len / 2 : -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - r * 2), 4, 8]} />
      <meshPhysicalMaterial color={color} roughness={0.85} metalness={0} />
    </mesh>
  );
}

// Ledsfär: markerar svängleder
function Joint({ r, color }: { r: number; color: string }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[r, 8, 6]} />
      <meshPhysicalMaterial color={color} roughness={0.88} metalness={0} />
    </mesh>
  );
}

function Head({ skinColor, hairColor }: { skinColor: string; hairColor: string }) {
  return (
    <>
      {/* Ansikt */}
      <mesh castShadow>
        <sphereGeometry args={[H_HEAD, 12, 8]} />
        <meshPhysicalMaterial color={skinColor} roughness={0.80} metalness={0} />
      </mesh>
      {/* Hår – mörk halvsfär på toppen */}
      <mesh position={[0, H_HEAD * 0.15, 0]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.82, 10, 6]} />
        <meshPhysicalMaterial color={hairColor} roughness={0.95} metalness={0} />
      </mesh>
    </>
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
  const HAIR = "#2d1a08";
  const kfs  = EXERCISES[exerciseId] ?? EXERCISES["floor:stand"]!;
  const mt   = mountType(exerciseId);
  const pH   = equipmentType.physicalHeightM;

  // ROOT (höfter) basposition i redskaps-lokal Y
  const baseY = (() => {
    if (mt === "hang-bar")     return pH - HANG_DIST;
    if (mt === "support-bar")  return pH + H_UPPER + H_LOWER - H_TORSO * 0.85;
    return pH + H_THIGH + H_SHIN;
  })();

  // Leds-refs
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
      rootRef.current.position.set(p.rootX, baseY + p.rootY, p.rootZ);
      rootRef.current.rotation.x = p.rootRotX;
      rootRef.current.rotation.y = p.rootRotY;
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
    <group ref={rootRef} position={[0, baseY, 0]}>

      {/* Höft-sfär vid ROOT */}
      <Joint r={0.065} color={color} />

      {/* ── Bål (uppåt från höfter) ───────────────────────── */}
      <group ref={spineRef}>
        <Seg len={H_TORSO} r={R_BODY} color={color} up />

        {/* Nacke */}
        <group position={[0, H_TORSO - 0.01, 0]}>
          <Seg len={H_NECK} r={0.030} color={SKIN} up />
        </group>

        {/* Huvud */}
        <group ref={headRef} position={[0, H_TORSO + H_NECK + H_HEAD * 0.85, 0]}>
          <Head skinColor={SKIN} hairColor={HAIR} />
        </group>

        {/* Axelsfärer (statiska, markerar skulderleden) */}
        <mesh position={[-W_SHLDR, H_TORSO * 0.85, 0]} castShadow>
          <sphereGeometry args={[0.048, 8, 6]} />
          <meshPhysicalMaterial color={color} roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[ W_SHLDR, H_TORSO * 0.85, 0]} castShadow>
          <sphereGeometry args={[0.048, 8, 6]} />
          <meshPhysicalMaterial color={color} roughness={0.88} metalness={0} />
        </mesh>

        {/* Vänster arm */}
        <group ref={lShRef} position={[-W_SHLDR, H_TORSO * 0.85, 0]}>
          <Seg len={H_UPPER} r={R_LIMB} color={color} />
          {/* Armbåge */}
          <group ref={lElRef} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.10} color={color} />
            <Seg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} />
            {/* Hand */}
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.028, 8, 5]} />
              <meshPhysicalMaterial color={SKIN} roughness={0.78} metalness={0} />
            </mesh>
          </group>
        </group>

        {/* Höger arm */}
        <group ref={rShRef} position={[ W_SHLDR, H_TORSO * 0.85, 0]}>
          <Seg len={H_UPPER} r={R_LIMB} color={color} />
          <group ref={rElRef} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.10} color={color} />
            <Seg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} />
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.028, 8, 5]} />
              <meshPhysicalMaterial color={SKIN} roughness={0.78} metalness={0} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── Vänster ben (nedåt från höfter) ────────────────── */}
      <mesh position={[-W_HIP, 0, 0]} castShadow>
        <sphereGeometry args={[0.052, 8, 6]} />
        <meshPhysicalMaterial color={color} roughness={0.90} metalness={0} />
      </mesh>
      <group ref={lHipRef} position={[-W_HIP, 0, 0]}>
        <Seg len={H_THIGH} r={R_LEG} color={color} />
        {/* Knä */}
        <group ref={lKnRef} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.05} color={color} />
          <Seg len={H_SHIN} r={R_LEG * 0.85} color={color} />
          {/* Fot */}
          <mesh position={[0, -H_SHIN - 0.015, 0.028]}
                rotation={[-P * 0.20, 0, 0]} castShadow>
            <capsuleGeometry args={[0.022, 0.055, 3, 6]} />
            <meshPhysicalMaterial color="#1c1c1c" roughness={0.96} metalness={0} />
          </mesh>
        </group>
      </group>

      {/* ── Höger ben ───────────────────────────────────────── */}
      <mesh position={[W_HIP, 0, 0]} castShadow>
        <sphereGeometry args={[0.052, 8, 6]} />
        <meshPhysicalMaterial color={color} roughness={0.90} metalness={0} />
      </mesh>
      <group ref={rHipRef} position={[W_HIP, 0, 0]}>
        <Seg len={H_THIGH} r={R_LEG} color={color} />
        <group ref={rKnRef} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.05} color={color} />
          <Seg len={H_SHIN} r={R_LEG * 0.85} color={color} />
          <mesh position={[0, -H_SHIN - 0.015, 0.028]}
                rotation={[-P * 0.20, 0, 0]} castShadow>
            <capsuleGeometry args={[0.022, 0.055, 3, 6]} />
            <meshPhysicalMaterial color="#1c1c1c" roughness={0.96} metalness={0} />
          </mesh>
        </group>
      </group>

    </group>
  );
}
