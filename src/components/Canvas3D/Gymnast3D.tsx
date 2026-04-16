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
  spineX: number; spineZ: number;
  headX:  number; headZ:  number;
  lShX: number; lShZ: number; lElX: number;
  rShX: number; rShZ: number; rElX: number;
  lHipX: number; lKnX: number;
  rHipX: number; rKnX: number;
  rootX: number; rootY: number; rootZ: number;
  rootRotX: number; rootRotY: number;
};

const ZERO: Pose = {
  spineX: 0, spineZ: 0, headX: 0, headZ: 0,
  lShX: 0,  lShZ: 0,  lElX: 0,
  rShX: 0,  rShZ: 0,  rElX: 0,
  lHipX: 0, lKnX: 0,
  rHipX: 0, rKnX: 0,
  rootX: 0, rootY: 0, rootZ: 0,
  rootRotX: 0, rootRotY: 0,
};

// ─── Övningsdefinition med valfri framåtrörelse ──────────────────────────────
type ExerciseDef = {
  kfs: KF[];
  advance?: number;   // meter framåt per cykel
  range?: number;     // ping-pong-avstånd i meter
  baseRotY?: number;  // basrotation kring Y – vrider gymnasten mot redskapets längdriktning
};

// Armar sträckta uppåt (−π vrider neråt-segmentet till uppåt)
const HANG_STRAIGHT: Pose = { ...ZERO, lShX: -Math.PI, rShX: -Math.PI };

// ─── Keyframe-hjälpare ────────────────────────────────────────────────────────
type KF = { t: number; pose: Pose };

function lerpPose(a: Pose, b: Pose, alpha: number): Pose {
  const l = (k: keyof Pose) =>
    (a[k] as number) + ((b[k] as number) - (a[k] as number)) * alpha;
  return {
    spineX: l("spineX"), spineZ: l("spineZ"),
    headX: l("headX"), headZ: l("headZ"),
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
// rootZ måste vara NEGATIV sin(a) för att kompensera rotationens förskjutning
function pend(a: number) {
  return {
    rootZ: -HANG_DIST * Math.sin(a),
    rootY:  HANG_DIST * (1 - Math.cos(a)),
  };
}

// ─── Animationer ──────────────────────────────────────────────────────────────
const P = Math.PI;

// Armar ut åt sidan för balans (bom-stil)
const ARMS_SIDE: Partial<Pose> = { lShZ: -P * 0.28, rShZ: P * 0.28, lElX: P * 0.05, rElX: P * 0.05 };

const EXERCISES: Record<string, ExerciseDef> = {

  // ── Räck ───────────────────────────────────────────────────────────────────

  // Jättesving – ROOT cirkulerar runt stången i YZ-planet
  "high-bar:giant-swing": { kfs: (() => {
    const N = 20;
    return Array.from({ length: N + 1 }, (_, i) => {
      const a   = (i / N) * 2 * P;
      const bow = Math.sin(a) * 0.04;  // minimal spineX – mer orsakar handdrift
      return {
        t: i * (1.6 / N),
        pose: {
          ...HANG_STRAIGHT,
          spineX: bow,
          lHipX: -Math.abs(Math.sin(a)) * 0.09,
          rHipX: -Math.abs(Math.sin(a)) * 0.09,
          rootRotX: a,
          rootZ: -HANG_DIST * Math.sin(a),
          rootY:  HANG_DIST * (1 - Math.cos(a)),
        } satisfies Pose,
      };
    });
  })() },

  // Kip – häng → pike → sving upp → stöd → häng
  // Händer låsta vid stången via HANG_STRAIGHT + pend() under svingfaserna
  "high-bar:kip": { kfs: [
    // Häng
    { t: 0,    pose: { ...HANG_STRAIGHT } },
    // Liten baksving
    { t: 0.30, pose: { ...HANG_STRAIGHT,
        rootRotX: -P*0.15, ...pend(-P*0.15) } },
    // Framsving + pike (tårna mot stången)
    { t: 0.75, pose: { ...HANG_STRAIGHT,
        lHipX: -P*0.60, rHipX: -P*0.60,
        lKnX: P*0.08, rKnX: P*0.08,
        spineX: -P*0.08,
        rootRotX: P*0.08, ...pend(P*0.08) } },
    // Extension – kroppen skjuter upp
    { t: 1.05, pose: { ...HANG_STRAIGHT,
        lHipX: -P*0.10, rHipX: -P*0.10,
        rootRotX: P*0.40, ...pend(P*0.40) } },
    // Kroppen roterar över stången
    { t: 1.25, pose: { ...HANG_STRAIGHT,
        rootRotX: P*0.55, ...pend(P*0.55) } },
    // Snabb övergång till stöd (0.15 s)
    { t: 1.40, pose: { ...ZERO,
        lShX: P*0.05, rShX: P*0.05,
        lElX: P*0.08, rElX: P*0.08,
        rootY: 1.02 } },
    // Håll stöd
    { t: 2.00, pose: { ...ZERO,
        lShX: P*0.04, rShX: P*0.04,
        lElX: P*0.06, rElX: P*0.06,
        rootY: 1.04 } },
    // Tillbaka till häng
    { t: 2.50, pose: { ...HANG_STRAIGHT } },
  ] },

  // Enkel sving räck – pendel från händerna
  "high-bar:swing": { kfs: (() => {
    const a = P * 0.30;
    const fwd: Pose = { ...HANG_STRAIGHT, rootRotX:  a, lHipX:  P*0.1,  rHipX:  P*0.1,  spineX: -P*0.015, ...pend( a) };
    const bak: Pose = { ...HANG_STRAIGHT, rootRotX: -a, lHipX: -P*0.08, rHipX: -P*0.08, spineX:  P*0.015, ...pend(-a) };
    return [
      { t: 0.0, pose: fwd },
      { t: 0.9, pose: bak },
      { t: 1.8, pose: fwd },
    ];
  })() },

  // ── Barr ───────────────────────────────────────────────────────────────────

  // Barrsving – gymnasten tittar längs barrarna (+X)
  "parallel-bars:swing": { baseRotY: P / 2, kfs: [
    { t: 0,   pose: { ...ZERO, lShX:-P*0.09, rShX:-P*0.09, lElX:P*0.12, rElX:P*0.12,
                      lHipX: P*0.58, rHipX: P*0.58, lKnX: P*0.12, rKnX: P*0.12 } },
    { t: 0.8, pose: { ...ZERO, lShX: P*0.09, rShX: P*0.09, lElX:P*0.12, rElX:P*0.12,
                      lHipX:-P*0.48, rHipX:-P*0.48, lKnX: P*0.10, rKnX: P*0.10 } },
    { t: 1.6, pose: { ...ZERO, lShX:-P*0.09, rShX:-P*0.09, lElX:P*0.12, rElX:P*0.12,
                      lHipX: P*0.58, rHipX: P*0.58, lKnX: P*0.12, rKnX: P*0.12 } },
  ] },

  // Stöd barr
  "parallel-bars:support": { baseRotY: P / 2, kfs: [
    { t: 0,   pose: { ...ZERO, lElX:P*0.10, rElX:P*0.10, spineX:-P*0.04 } },
    { t: 1.5, pose: { ...ZERO, lElX:P*0.07, rElX:P*0.07, spineX: P*0.03, rootY:0.03,
                      lShZ:-0.04, rShZ: 0.04 } },
    { t: 3.0, pose: { ...ZERO, lElX:P*0.10, rElX:P*0.10, spineX:-P*0.04 } },
  ] },

  // Ojämna barr – pendel
  "uneven-bars:swing": { kfs: (() => {
    const a = P * 0.28;
    const fwd: Pose = { ...HANG_STRAIGHT, rootRotX:  a, lHipX:  P*0.10, rHipX:  P*0.10, ...pend( a) };
    const bak: Pose = { ...HANG_STRAIGHT, rootRotX: -a, lHipX: -P*0.07, rHipX: -P*0.07, ...pend(-a) };
    return [
      { t: 0.0, pose: fwd },
      { t: 0.9, pose: bak },
      { t: 1.8, pose: fwd },
    ];
  })() },

  // ── Bom ────────────────────────────────────────────────────────────────────

  // Gång bom – gymnasten rör sig framåt längs bommen
  "beam:walk": {
    baseRotY: P / 2,  // vänd gymnasten så den tittar längs bommen (+X)
    advance: 0.65,     // 0.65 m per 2 s cykel ≈ 0.33 m/s
    range: 3.5,
    kfs: [
      // Vänster fot framme, höger bak – höger arm framåt (contra-lateral)
      { t: 0,    pose: { ...ZERO,
          lHipX:-P*0.12, rHipX: P*0.22, rKnX: P*0.10,
          lShX: P*0.10, rShX:-P*0.08,
          ...ARMS_SIDE,
          spineZ: 0.025, rootY:-0.01 } },
      // Transition – höger ben svänger framåt
      { t: 0.5,  pose: { ...ZERO,
          lHipX: P*0.04, rHipX:-P*0.10, rKnX: P*0.20,
          rShX: P*0.04, lShX:-P*0.04,
          ...ARMS_SIDE,
          spineZ:-0.02, rootY: 0.02 } },
      // Höger fot framme, vänster bak – vänster arm framåt (contra-lateral)
      { t: 1.0,  pose: { ...ZERO,
          rHipX:-P*0.12, lHipX: P*0.22, lKnX: P*0.10,
          rShX: P*0.10, lShX:-P*0.08,
          ...ARMS_SIDE,
          spineZ:-0.025, rootY:-0.01 } },
      // Transition – vänster ben svänger framåt
      { t: 1.5,  pose: { ...ZERO,
          rHipX: P*0.04, lHipX:-P*0.10, lKnX: P*0.20,
          lShX: P*0.04, rShX:-P*0.04,
          ...ARMS_SIDE,
          spineZ: 0.02, rootY: 0.02 } },
      // Loop
      { t: 2.0,  pose: { ...ZERO,
          lHipX:-P*0.12, rHipX: P*0.22, rKnX: P*0.10,
          lShX: P*0.10, rShX:-P*0.08,
          ...ARMS_SIDE,
          spineZ: 0.025, rootY:-0.01 } },
    ],
  },

  // Hopp bom
  "beam:jump": { baseRotY: P / 2, kfs: [
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 0.25, pose: { ...ZERO, lHipX:-P*0.10, rHipX:-P*0.10, lKnX:P*0.14, rKnX:P*0.14,
                       rootY:-0.06, lShZ:-P*0.20, rShZ:P*0.20 } },
    { t: 0.50, pose: { ...ZERO, rootY:0.28,
                       lShX:-P*0.6, rShX:-P*0.6, lShZ:-P*0.10, rShZ:P*0.10,
                       spineX:-P*0.03, headX:-P*0.05 } },
    { t: 0.75, pose: { ...ZERO, rootY:0.20,
                       lShX:-P*0.4, rShX:-P*0.4, lShZ:-P*0.15, rShZ:P*0.15 } },
    { t: 1.05, pose: { ...ZERO, lHipX:-P*0.08, rHipX:-P*0.08, lKnX:P*0.12, rKnX:P*0.12,
                       rootY:-0.05, lShZ:-P*0.22, rShZ:P*0.22 } },
    { t: 1.40, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },

  // Stå (bom) – armar ut åt sidan, subtil andning
  "beam:stand": { baseRotY: P / 2, kfs: [
    { t: 0,   pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 2.0, pose: { ...ZERO, ...ARMS_SIDE, spineX:P*0.015, rootY:0.008, spineZ:0.01 } },
    { t: 4.0, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },

  // Arabesque – vänster ben bak, armar i balansposition
  "beam:arabesque": { baseRotY: P / 2, kfs: [
    { t: 0,   pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 0.70, pose: { ...ZERO,
        lHipX: P*0.50, lKnX: P*0.03,
        rHipX: -P*0.04,
        spineX: -P*0.10, spineZ: 0.02,
        lShX: -P*0.70, lShZ:-P*0.10, lElX: P*0.05,
        rShZ: P*0.42, rShX:-P*0.04, rElX: P*0.04,
        headX: -P*0.06,
        rootY: 0.01 } },
    { t: 2.80, pose: { ...ZERO,
        lHipX: P*0.52, lKnX: P*0.03,
        rHipX: -P*0.04,
        spineX: -P*0.09, spineZ: 0.02,
        lShX: -P*0.72, lShZ:-P*0.10, lElX: P*0.05,
        rShZ: P*0.40, rShX:-P*0.04, rElX: P*0.04,
        headX: -P*0.06,
        rootY: 0.01 } },
    { t: 3.50, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },

  // Knähopp (tuck jump) – armar driver uppåt, tuck med händer mot knän
  "beam:tuck-jump": { baseRotY: P / 2, kfs: [
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 0.22, pose: { ...ZERO, lKnX:P*0.14, rKnX:P*0.14, lHipX:-P*0.08, rHipX:-P*0.08,
                       rootY:-0.07, lShZ:-P*0.18, rShZ:P*0.18 } },
    { t: 0.45, pose: { ...ZERO, rootY:0.30,
                       lShX:-P*0.5, rShX:-P*0.5, lShZ:-P*0.06, rShZ:P*0.06,
                       spineX:-P*0.03 } },
    { t: 0.62, pose: { ...ZERO, lHipX:-P*0.72, rHipX:-P*0.72, lKnX:P*0.55, rKnX:P*0.55,
                       spineX:-P*0.08, rootY:0.34,
                       lShX:-P*0.30, rShX:-P*0.30, lElX:P*0.45, rElX:P*0.45 } },
    { t: 0.85, pose: { ...ZERO, rootY:0.15,
                       lShX:-P*0.3, rShX:-P*0.3, lShZ:-P*0.12, rShZ:P*0.12 } },
    { t: 1.05, pose: { ...ZERO, lHipX:-P*0.08, rHipX:-P*0.08, lKnX:P*0.12, rKnX:P*0.12,
                       rootY:-0.05, lShZ:-P*0.22, rShZ:P*0.22 } },
    { t: 1.40, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },

  // Pirouette – relevé, armar in under vridning
  "beam:pirouette": { baseRotY: P / 2, kfs: [
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE, rootRotY: 0 } },
    { t: 0.25, pose: { ...ZERO, rootY:0.06, rootRotY: P*0.3,
                       lShZ:-P*0.12, rShZ:P*0.12, lElX:P*0.15, rElX:P*0.15,
                       lHipX:P*0.03, rKnX:-P*0.05 } },
    { t: 0.70, pose: { ...ZERO, rootY:0.07, rootRotY: P*0.8,
                       lShZ:-P*0.06, rShZ:P*0.06, lElX:P*0.25, rElX:P*0.25 } },
    { t: 1.20, pose: { ...ZERO, rootY:0.07, rootRotY: P*1.3,
                       lShZ:-P*0.06, rShZ:P*0.06, lElX:P*0.25, rElX:P*0.25 } },
    { t: 1.80, pose: { ...ZERO, rootY:0.05, rootRotY: P*1.8,
                       lShZ:-P*0.10, rShZ:P*0.10, lElX:P*0.10, rElX:P*0.10 } },
    { t: 2.20, pose: { ...ZERO, rootY:0.02, rootRotY: P*2,
                       ...ARMS_SIDE } },
    { t: 2.50, pose: { ...ZERO, rootRotY: P*2, ...ARMS_SIDE } },
  ] },

  // Stegserie 1 – detaljerad bomrutin:
  //   stå → hopp till sit → ridsit → huksit → hukgång → pik →
  //   björngång → stå (händer bak) → gång tå → avhopp
  "beam:stegserie-1": { baseRotY: P / 2, kfs: [

    // ── Fas 1: Stå på golvet bredvid bommen ──────────────────────────────
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE, rootY: -1.25, rootZ: 0.55 } },

    // ── Fas 2: Hopp till jämvägande sittande ────────────────────────────
    // Hoppförberedelse på golvet
    { t: 0.40, pose: { ...ZERO,
        lHipX: -P*0.08, rHipX: -P*0.08, lKnX: P*0.15, rKnX: P*0.15,
        rootY: -1.30, rootZ: 0.55,
        lShZ: -P*0.18, rShZ: P*0.18 } },
    // I luften – hoppar upp mot bommen
    { t: 0.75, pose: { ...ZERO,
        rootY: 0.10, rootZ: 0.15,
        lShX: -P*0.30, rShX: -P*0.30,
        lShZ: -P*0.10, rShZ: P*0.10 } },
    // Landning sittande på bommen
    { t: 1.20, pose: { ...ZERO,
        lHipX: -P*0.50, rHipX: -P*0.50,
        lKnX: P*0.45, rKnX: P*0.45,
        spineX: -P*0.05, rootY: -0.55, ...ARMS_SIDE } },

    // ── Fas 3: Ena benet över → ridsittande, armar ut ───────────────────
    { t: 2.00, pose: { ...ZERO,
        lHipX: -P*0.45, rHipX: P*0.30,
        lKnX: P*0.35, rKnX: P*0.20,
        rootY: -0.55, ...ARMS_SIDE } },
    { t: 2.60, pose: { ...ZERO,
        lHipX: -P*0.42, rHipX: P*0.32,
        lKnX: P*0.32, rKnX: P*0.18,
        rootY: -0.55, ...ARMS_SIDE } },

    // ── Fas 4: Vipp till huksittande, händer i midjan ───────────────────
    { t: 3.20, pose: { ...ZERO,
        lHipX: -P*0.18, rHipX: -P*0.18,
        lKnX: P*0.55, rKnX: P*0.55,
        spineX: -P*0.12, rootY: -0.35,
        lShZ: -P*0.12, rShZ: P*0.12,
        lElX: P*0.55, rElX: P*0.55 } },

    // ── Fas 5: Gå två steg på huk, händer i midjan ─────────────────────
    { t: 3.90, pose: { ...ZERO,
        lHipX: -P*0.26, rHipX: -P*0.12,
        lKnX: P*0.48, rKnX: P*0.58,
        spineX: -P*0.12, rootY: -0.33, rootX: 0.25,
        lShZ: -P*0.12, rShZ: P*0.12,
        lElX: P*0.55, rElX: P*0.55 } },
    { t: 4.60, pose: { ...ZERO,
        lHipX: -P*0.12, rHipX: -P*0.26,
        lKnX: P*0.58, rKnX: P*0.48,
        spineX: -P*0.12, rootY: -0.33, rootX: 0.50,
        lShZ: -P*0.12, rShZ: P*0.12,
        lElX: P*0.55, rElX: P*0.55 } },

    // ── Fas 6: Sträck benen → pikstående, armar ut ──────────────────────
    { t: 5.20, pose: { ...ZERO,
        spineX: -P*0.50, rootY: -0.06, rootX: 0.55,
        ...ARMS_SIDE } },
    { t: 5.80, pose: { ...ZERO,
        spineX: -P*0.52, rootY: -0.06, rootX: 0.55,
        ...ARMS_SIDE } },

    // ── Fas 7: Händer på bom, gå med fötter och händer ──────────────────
    // (positiv lShX = armar bakåt relativt böjd bål → pekar NER mot bommen)
    { t: 6.30, pose: { ...ZERO,
        spineX: -P*0.55,
        lShX: P*0.50, rShX: P*0.50,
        lElX: P*0.10, rElX: P*0.10,
        rootY: -0.08, rootX: 0.60 } },
    { t: 6.90, pose: { ...ZERO,
        spineX: -P*0.55,
        lShX: P*0.55, rShX: P*0.42,
        lElX: P*0.10, rElX: P*0.10,
        lHipX: P*0.06, rHipX: -P*0.10, rKnX: P*0.10,
        rootY: -0.08, rootX: 0.80 } },
    { t: 7.50, pose: { ...ZERO,
        spineX: -P*0.55,
        lShX: P*0.42, rShX: P*0.55,
        lElX: P*0.10, rElX: P*0.10,
        lHipX: -P*0.10, rHipX: P*0.06, lKnX: P*0.10,
        rootY: -0.08, rootX: 1.00 } },

    // ── Fas 8: Res upp, sträckt kropp, händer bakom ryggen ──────────────
    { t: 8.10, pose: { ...ZERO,
        spineX: -P*0.10,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: 1.05 } },
    { t: 8.60, pose: { ...ZERO,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: 1.05 } },

    // ── Fas 9: Gå 2 steg med peka tå ────────────────────────────────────
    { t: 9.30, pose: { ...ZERO,
        lHipX: -P*0.16, rHipX: P*0.10, rKnX: P*0.06,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: 1.30 } },
    { t: 10.00, pose: { ...ZERO,
        rHipX: -P*0.16, lHipX: P*0.10, lKnX: P*0.06,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: 1.55 } },

    // ── Fas 10: Ytterligare 2 steg med tå och knä ───────────────────────
    { t: 10.70, pose: { ...ZERO,
        lHipX: -P*0.25, rHipX: P*0.08, lKnX: P*0.12,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: 1.80 } },
    { t: 11.40, pose: { ...ZERO,
        rHipX: -P*0.25, lHipX: P*0.08, rKnX: P*0.12,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: 2.05 } },

    // ── Fas 11: Steg ihop till samlat stående ───────────────────────────
    { t: 11.80, pose: { ...ZERO, ...ARMS_SIDE, rootX: 2.10 } },

    // ── Fas 12: Avhopp – ljushopp med armdrag, kontrollerad landning ────
    { t: 12.20, pose: { ...ZERO,
        lHipX: -P*0.08, rHipX: -P*0.08, lKnX: P*0.14, rKnX: P*0.14,
        rootY: -0.05, lShZ: -P*0.18, rShZ: P*0.18, rootX: 2.10 } },
    { t: 12.50, pose: { ...ZERO,
        rootY: 0.35,
        lShX: -P*0.75, rShX: -P*0.75,
        spineX: -P*0.02,
        rootX: 2.10, rootZ: 0.15 } },
    { t: 12.80, pose: { ...ZERO,
        rootY: 0.15,
        lShX: -P*0.80, rShX: -P*0.80,
        rootX: 2.10, rootZ: 0.45 } },
    { t: 13.10, pose: { ...ZERO,
        lHipX: -P*0.10, rHipX: -P*0.10, lKnX: P*0.16, rKnX: P*0.16,
        rootY: -1.20,
        lShZ: -P*0.22, rShZ: P*0.22,
        rootX: 2.10, rootZ: 0.55 } },
    { t: 13.50, pose: { ...ZERO,
        rootY: -1.25, ...ARMS_SIDE,
        rootX: 2.10, rootZ: 0.55 } },
    { t: 14.00, pose: { ...ZERO,
        rootY: -1.25, ...ARMS_SIDE,
        rootX: 2.10, rootZ: 0.55 } },
  ] },

  // ── Ringar ─────────────────────────────────────────────────────────────────

  "rings:swing": { kfs: (() => {
    const a = P * 0.26;
    const fwd: Pose = { ...HANG_STRAIGHT, lShZ:-0.10, rShZ:0.10, rootRotX: a, lHipX: P*0.08, rHipX: P*0.08, ...pend( a) };
    const bak: Pose = { ...HANG_STRAIGHT, lShZ:-0.10, rShZ:0.10, rootRotX:-a, lHipX:-P*0.06, rHipX:-P*0.06, ...pend(-a) };
    return [
      { t: 0.0, pose: fwd },
      { t: 0.9, pose: bak },
      { t: 1.8, pose: fwd },
    ];
  })() },

  "rings:cross": { kfs: [
    { t: 0,   pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.06 } },
    { t: 2.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.10, rElX:P*0.10, rootY:0.09, spineX:P*0.02 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.06 } },
  ] },

  // ── Fristående ─────────────────────────────────────────────────────────────

  "floor:handstand": { kfs: [
    { t: 0,   pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.17, spineX: -P*0.03 } },
    { t: 1.5, pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.19, spineX: P*0.03, headX: P*0.04 } },
    { t: 3.0, pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.17, spineX: -P*0.03 } },
  ] },

  "floor:stand": { kfs: [
    { t: 0,   pose: { ...ZERO, lShZ:-0.05, rShZ: 0.05, lElX:P*0.04, rElX:P*0.04 } },
    { t: 2.0, pose: { ...ZERO, spineX:P*0.015, lShZ: 0.04, rShZ:-0.04, rootY:0.008, lElX:P*0.03, rElX:P*0.03 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.05, rShZ: 0.05, lElX:P*0.04, rElX:P*0.04 } },
  ] },

  // ── Bygelhäst ──────────────────────────────────────────────────────────────

  "pommel-horse:scissors": { kfs: [
    { t: 0,   pose: { ...ZERO,
        lHipX: P*0.52, rHipX:-P*0.22, lKnX: P*0.06,
        lShX:-P*0.08, rShX:-P*0.04, lElX:P*0.19, rElX:P*0.14, rootY:0.09 } },
    { t: 0.7, pose: { ...ZERO,
        lHipX:-P*0.22, rHipX: P*0.52, rKnX: P*0.06,
        lShX:-P*0.04, rShX:-P*0.08, lElX:P*0.14, rElX:P*0.19, rootY:0.09 } },
    { t: 1.4, pose: { ...ZERO,
        lHipX: P*0.52, rHipX:-P*0.22, lKnX: P*0.06,
        lShX:-P*0.08, rShX:-P*0.04, lElX:P*0.19, rElX:P*0.14, rootY:0.09 } },
  ] },

  // ── Hopp ───────────────────────────────────────────────────────────────────

  // Handstående på hoppbord – gymnasten står på händer ovanpå bordet
  "vault:handstand": { kfs: [
    { t: 0,   pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.17, spineX: -P*0.03 } },
    { t: 1.5, pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.19, spineX: P*0.03, headX: P*0.04 } },
    { t: 3.0, pose: { ...ZERO,
        lShX: -P, rShX: -P,
        rootRotX: P, rootY: 0.17, spineX: -P*0.03 } },
  ] },

  // ── Trampett ───────────────────────────────────────────────────────────────

  "mini-tramp:bounce": { kfs: [
    { t: 0,    pose: { ...ZERO } },
    { t: 0.20, pose: { ...ZERO, lKnX:P*0.15, rKnX:P*0.15, lHipX:-P*0.08, rHipX:-P*0.08,
                       rootY:-0.06, lShZ:-P*0.10, rShZ:P*0.10 } },
    { t: 0.45, pose: { ...ZERO, rootY:0.32,
                       lShX:-P*0.4, rShX:-P*0.4, lShZ:-P*0.10, rShZ:P*0.10,
                       spineX:-P*0.02 } },
    { t: 0.70, pose: { ...ZERO, rootY:0.15,
                       lShX:-P*0.2, rShX:-P*0.2, lShZ:-P*0.12, rShZ:P*0.12 } },
    { t: 0.85, pose: { ...ZERO, lKnX:P*0.13, rKnX:P*0.13, lHipX:-P*0.07, rHipX:-P*0.07,
                       rootY:-0.05, lShZ:-P*0.08, rShZ:P*0.08 } },
    { t: 1.0,  pose: { ...ZERO } },
  ] },

  // ── Plint ──────────────────────────────────────────────────────────────────

  "plinth:stand": { kfs: [
    { t: 0,   pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06, lElX:P*0.04, rElX:P*0.04 } },
    { t: 2.0, pose: { ...ZERO, spineX:P*0.015, lShZ: 0.04, rShZ:-0.04, rootY:0.008 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06, lElX:P*0.04, rElX:P*0.04 } },
  ] },
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
  // Gymnasten står på golvet BREDVID redskapet, inte ovanpå
  return "stand-surface";
}

// ─── Primitiver ───────────────────────────────────────────────────────────────
// Leotard-segment: atletiskt tyg med subtilt skimmer
function LeotardSeg({ len, r, color, up = false }: { len: number; r: number; color: string; up?: boolean }) {
  return (
    <mesh position={[0, up ? len / 2 : -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - r * 2), 6, 10]} />
      <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} clearcoat={0.25} clearcoatRoughness={0.35} />
    </mesh>
  );
}

// Hudsegment: mjuk matt yta
function SkinSeg({ len, r, color, up = false }: { len: number; r: number; color: string; up?: boolean }) {
  return (
    <mesh position={[0, up ? len / 2 : -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - r * 2), 6, 10]} />
      <meshPhysicalMaterial color={color} roughness={0.72} metalness={0} />
    </mesh>
  );
}

// Ledsfär
function Joint({ r, color, leotard = false }: { r: number; color: string; leotard?: boolean }) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[r, 10, 8]} />
      <meshPhysicalMaterial
        color={color}
        roughness={leotard ? 0.55 : 0.72}
        metalness={leotard ? 0.02 : 0}
        clearcoat={leotard ? 0.25 : 0}
        clearcoatRoughness={0.35}
      />
    </mesh>
  );
}

function Head({ skinColor, hairColor }: { skinColor: string; hairColor: string }) {
  return (
    <>
      {/* Ansikte */}
      <mesh castShadow>
        <sphereGeometry args={[H_HEAD, 14, 10]} />
        <meshPhysicalMaterial color={skinColor} roughness={0.68} metalness={0} />
      </mesh>
      {/* Hår – slät kalott */}
      <mesh position={[0, H_HEAD * 0.18, 0]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.84, 12, 8]} />
        <meshPhysicalMaterial color={hairColor} roughness={0.82} metalness={0.03} clearcoat={0.15} clearcoatRoughness={0.5} />
      </mesh>
      {/* Tofs / hästsvans */}
      <mesh position={[0, H_HEAD * 0.45, -H_HEAD * 0.55]} rotation={[0.55, 0, 0]} castShadow>
        <capsuleGeometry args={[0.018, 0.08, 4, 6]} />
        <meshPhysicalMaterial color={hairColor} roughness={0.85} metalness={0} />
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
  const def  = EXERCISES[exerciseId] ?? EXERCISES["floor:stand"]!;
  const kfs  = def.kfs;
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
    const raw = clock.getElapsedTime();
    const p = evalKF(kfs, raw);

    // Basrotation – vrider gymnasten mot redskapets längdriktning
    if (def.baseRotY) p.rootRotY += def.baseRotY;

    // Framåtrörelse (ping-pong) för gång-övningar
    if (def.advance && def.advance > 0) {
      const dur = kfs[kfs.length - 1].t;
      const dist = (raw / dur) * def.advance;
      const totalRange = def.range ?? 3.0;
      const period = totalRange * 2;
      const phase = dist % period;
      if (phase <= totalRange) {
        p.rootX += phase - totalRange / 2;
      } else {
        p.rootX += (period - phase) - totalRange / 2;
        p.rootRotY += P; // vänd gymnasten vid återgång
      }
    }

    if (rootRef.current) {
      rootRef.current.position.set(p.rootX, baseY + p.rootY, p.rootZ);
      rootRef.current.rotation.x = p.rootRotX;
      rootRef.current.rotation.y = p.rootRotY;
    }
    if (spineRef.current) { spineRef.current.rotation.x = p.spineX; spineRef.current.rotation.z = p.spineZ; }
    if (headRef.current)  { headRef.current.rotation.x  = p.headX;  headRef.current.rotation.z  = p.headZ; }

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

      {/* Höft-sfär */}
      <Joint r={0.065} color={color} leotard />

      {/* ── Bål (uppåt från höfter) ───────────────────────── */}
      <group ref={spineRef}>
        <LeotardSeg len={H_TORSO} r={R_BODY} color={color} up />

        {/* Nacke */}
        <group position={[0, H_TORSO - 0.01, 0]}>
          <SkinSeg len={H_NECK} r={0.030} color={SKIN} up />
        </group>

        {/* Huvud */}
        <group ref={headRef} position={[0, H_TORSO + H_NECK + H_HEAD * 0.85, 0]}>
          <Head skinColor={SKIN} hairColor={HAIR} />
        </group>

        {/* Axelsfärer */}
        {([-W_SHLDR, W_SHLDR] as number[]).map((x, i) => (
          <mesh key={i} position={[x, H_TORSO * 0.85, 0]} castShadow>
            <sphereGeometry args={[0.048, 10, 8]} />
            <meshPhysicalMaterial color={color} roughness={0.55} metalness={0.02} clearcoat={0.25} clearcoatRoughness={0.35} />
          </mesh>
        ))}

        {/* Vänster arm: överarm leotard, underarm hud */}
        <group ref={lShRef} position={[-W_SHLDR, H_TORSO * 0.85, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB} color={color} />
          <group ref={lElRef} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.10} color={SKIN} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} />
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.028, 8, 6]} />
              <meshPhysicalMaterial color={SKIN} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>

        {/* Höger arm */}
        <group ref={rShRef} position={[ W_SHLDR, H_TORSO * 0.85, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB} color={color} />
          <group ref={rElRef} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.10} color={SKIN} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.85} color={SKIN} />
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.028, 8, 6]} />
              <meshPhysicalMaterial color={SKIN} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── Vänster ben: lår leotard, smalben hud ─────────── */}
      <Joint r={0.052} color={color} leotard />
      <group ref={lHipRef} position={[-W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG} color={color} />
        <group ref={lKnRef} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.05} color={SKIN} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.85} color={SKIN} />
          {/* Gymnastikskor – vit sula, ljusare */}
          <mesh position={[0, -H_SHIN - 0.015, 0.028]}
                rotation={[-P * 0.20, 0, 0]} castShadow>
            <capsuleGeometry args={[0.024, 0.058, 4, 8]} />
            <meshPhysicalMaterial color="#F0F0F0" roughness={0.75} metalness={0} />
          </mesh>
        </group>
      </group>

      {/* ── Höger ben ───────────────────────────────────────── */}
      <group ref={rHipRef} position={[W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG} color={color} />
        <group ref={rKnRef} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.05} color={SKIN} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.85} color={SKIN} />
          <mesh position={[0, -H_SHIN - 0.015, 0.028]}
                rotation={[-P * 0.20, 0, 0]} castShadow>
            <capsuleGeometry args={[0.024, 0.058, 4, 8]} />
            <meshPhysicalMaterial color="#F0F0F0" roughness={0.75} metalness={0} />
          </mesh>
        </group>
      </group>

    </group>
  );
}
