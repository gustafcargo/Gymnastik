/**
 * Pose- och KF-typer för gymnast-animationen.
 *
 * Delas mellan runtime-animationen (`Gymnast3D`, `GameGymnast3D`) och
 * Övningsstudion (`ExerciseStudio`). Att ha en enda källa för typerna gör att
 * studions pose-editor kan producera samma struktur som built-in-övningarna
 * utan duplicerade type-definitioner.
 */
import { HANG_DIST, H_THIGH, H_SHIN } from "../components/Canvas3D/GymnastBody";

// Räckets greppradie – händer rör sig runt stången i en liten cirkel
// snarare än en exakt punkt.
const BAR_R = 0.015;
// Benens totala längd – golvpivot för fot-lås.
const LEG_DIST = H_THIGH + H_SHIN;

export type LockMode = "none" | "hands" | "feet";

export type Pose = {
  spineX: number; spineZ: number;
  headX:  number; headZ:  number;
  lShX: number; lShZ: number; lElX: number;
  rShX: number; rShZ: number; rElX: number;
  lHipX: number; lHipZ: number; lKnX: number;
  rHipX: number; rHipZ: number; rKnX: number;
  rootX: number; rootY: number; rootZ: number;
  rootRotX: number; rootRotY: number;
};

export type KF = {
  t: number;
  pose: Pose;
  /**
   * Om false hoppar pivot-låset över denna KF – t.ex. ett släpp-moment i
   * en sving där gymnasten lämnar räcket. evalKF tillämpar inte lås-formeln
   * under interpoleringen till/från en KF med locked === false.
   */
  locked?: boolean;
};

export type ExerciseDef = {
  kfs: KF[];
  advance?: number;   // meter framåt per cykel
  range?: number;     // ping-pong-avstånd i meter
  baseRotY?: number;  // basrotation kring Y – vrider gymnasten mot redskapets längdriktning
  /**
   * Pivot-lås: när satt till "hands"/"feet" räknar `evalKF` automatiskt ut
   * rootY/rootZ från den interpolerade rootRotX via lås-formeln, så att
   * händer (räcke) eller fötter (golv) verkligen stannar på plats under
   * HELA interpoleringen – inte bara i keyframe-ögonblicken. Varje KF:s
   * befintliga rootY/rootZ tolkas som "offset" ovanpå lås-formeln.
   */
  lockMode?: LockMode;
};

export const POSE_KEYS: (keyof Pose)[] = [
  "spineX", "spineZ", "headX", "headZ",
  "lShX", "lShZ", "lElX",
  "rShX", "rShZ", "rElX",
  "lHipX", "lHipZ", "lKnX",
  "rHipX", "rHipZ", "rKnX",
  "rootX", "rootY", "rootZ",
  "rootRotX", "rootRotY",
];

export const ZERO: Pose = {
  spineX: 0, spineZ: 0, headX: 0, headZ: 0,
  lShX: 0,  lShZ: 0,  lElX: 0,
  rShX: 0,  rShZ: 0,  rElX: 0,
  lHipX: 0, lHipZ: 0, lKnX: 0,
  rHipX: 0, rHipZ: 0, rKnX: 0,
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

// Räkna ut rootY/rootZ så att händer (hang-bar) eller fötter (golvpivot)
// förblir fasta när kroppen roterar kring X (rootRotX). Händerna traverserar
// en cirkel med radie BAR_R runt stångens centrum (inte en exakt punkt).
export function applyLock(pose: Pose, mode: LockMode): Pose {
  if (mode === "hands") {
    const a = pose.rootRotX;
    return {
      ...pose,
      rootZ: -(HANG_DIST - BAR_R) * Math.sin(a),
      rootY:  HANG_DIST - (HANG_DIST - BAR_R) * Math.cos(a),
    };
  }
  if (mode === "feet") {
    return {
      ...pose,
      rootZ: -LEG_DIST * Math.sin(pose.rootRotX),
      rootY:  LEG_DIST * (Math.cos(pose.rootRotX) - 1),
    };
  }
  return pose;
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

/**
 * Utvärderar en hel ExerciseDef – samma som evalKF, men om `def.lockMode` är
 * satt applicerar vi pivot-lås-formeln även UNDER interpoleringen (inte bara
 * i KF-ögonblicken). Mellan två låsta KFs blir då rootY/rootZ exakt pivot-
 * cirkeln(+interpolerad offset) i stället för ett linjärt chord – annars
 * driver händerna bort från stången mellan keyframes trots att varje KF
 * sitter perfekt. KFs med `locked === false` behandlas som fritt flyg och
 * lämnas linjärt interpolerade (släppmoment).
 */
export function evalExercise(def: ExerciseDef, t: number): Pose {
  const kfs = def.kfs;
  if (!kfs.length) return ZERO;
  if (kfs.length === 1) return kfs[0].pose;
  const dur = kfs[kfs.length - 1].t;
  const tn  = dur > 0 ? t % dur : 0;
  const mode = def.lockMode ?? "none";

  for (let i = 0; i < kfs.length - 1; i++) {
    const k0 = kfs[i];
    const k1 = kfs[i + 1];
    if (tn >= k0.t && tn < k1.t) {
      const alpha = (tn - k0.t) / (k1.t - k0.t);
      const interp = lerpPose(k0.pose, k1.pose, alpha);
      const bothLocked = mode !== "none" && k0.locked !== false && k1.locked !== false;
      if (!bothLocked) return interp;

      // Interpolera offset (manuell justering ovanpå ren lås-formel) linjärt,
      // lägg till den ovanpå lås(interpolerad rootRotX) så händer/fötter följer
      // pivot-cirkeln även mellan keyframes.
      const l0 = applyLock(k0.pose, mode);
      const l1 = applyLock(k1.pose, mode);
      const offY = (k0.pose.rootY - l0.rootY) + ((k1.pose.rootY - l1.rootY) - (k0.pose.rootY - l0.rootY)) * alpha;
      const offZ = (k0.pose.rootZ - l0.rootZ) + ((k1.pose.rootZ - l1.rootZ) - (k0.pose.rootZ - l0.rootZ)) * alpha;
      const locked = applyLock(interp, mode);
      return { ...interp, rootY: locked.rootY + offY, rootZ: locked.rootZ + offZ };
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
