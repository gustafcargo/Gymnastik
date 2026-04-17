/**
 * Pose- och KF-typer för gymnast-animationen.
 *
 * Delas mellan runtime-animationen (`Gymnast3D`, `GameGymnast3D`) och
 * Övningsstudion (`ExerciseStudio`). Att ha en enda källa för typerna gör att
 * studions pose-editor kan producera samma struktur som built-in-övningarna
 * utan duplicerade type-definitioner.
 */
import { HANG_DIST } from "../components/Canvas3D/GymnastBody";

export type Pose = {
  spineX: number; spineZ: number;
  headX:  number; headZ:  number;
  lShX: number; lShZ: number; lElX: number;
  rShX: number; rShZ: number; rElX: number;
  lHipX: number; lKnX: number;
  rHipX: number; rKnX: number;
  rootX: number; rootY: number; rootZ: number;
  rootRotX: number; rootRotY: number;
};

export type KF = { t: number; pose: Pose };

export type ExerciseDef = {
  kfs: KF[];
  advance?: number;   // meter framåt per cykel
  range?: number;     // ping-pong-avstånd i meter
  baseRotY?: number;  // basrotation kring Y – vrider gymnasten mot redskapets längdriktning
};

export const POSE_KEYS: (keyof Pose)[] = [
  "spineX", "spineZ", "headX", "headZ",
  "lShX", "lShZ", "lElX",
  "rShX", "rShZ", "rElX",
  "lHipX", "lKnX", "rHipX", "rKnX",
  "rootX", "rootY", "rootZ",
  "rootRotX", "rootRotY",
];

export const ZERO: Pose = {
  spineX: 0, spineZ: 0, headX: 0, headZ: 0,
  lShX: 0,  lShZ: 0,  lElX: 0,
  rShX: 0,  rShZ: 0,  rElX: 0,
  lHipX: 0, lKnX: 0,
  rHipX: 0, rKnX: 0,
  rootX: 0, rootY: 0, rootZ: 0,
  rootRotX: 0, rootRotY: 0,
};

// Armar sträckta uppåt (+π vrider neråt-segmentet upp via framsidan,
// så att nedgång till stöd/häng rör sig framför kroppen – inte bakåt).
export const HANG_STRAIGHT: Pose = { ...ZERO, lShX: Math.PI, rShX: Math.PI };

export function lerpPose(a: Pose, b: Pose, alpha: number): Pose {
  const out = {} as Pose;
  for (const k of POSE_KEYS) {
    out[k] = a[k] + (b[k] - a[k]) * alpha;
  }
  return out;
}

export function evalKF(kfs: KF[], t: number): Pose {
  if (!kfs.length) return ZERO;
  if (kfs.length === 1) return kfs[0].pose;
  const dur = kfs[kfs.length - 1].t;
  const tn  = dur > 0 ? t % dur : 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (tn >= kfs[i].t && tn < kfs[i + 1].t) {
      const a = (tn - kfs[i].t) / (kfs[i + 1].t - kfs[i].t);
      return lerpPose(kfs[i].pose, kfs[i + 1].pose, a);
    }
  }
  return kfs[kfs.length - 1].pose;
}

// Pendel-förskjutning: håller händerna vid stången vid vinkel a.
// rootZ måste vara NEGATIV sin(a) för att kompensera rotationens förskjutning.
export function pend(a: number) {
  return {
    rootZ: -HANG_DIST * Math.sin(a),
    rootY:  HANG_DIST * (1 - Math.cos(a)),
  };
}
