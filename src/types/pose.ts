/**
 * Pose- och KF-typer för gymnast-animationen.
 *
 * Delas mellan runtime-animationen (`Gymnast3D`, `GameGymnast3D`) och
 * Övningsstudion (`ExerciseStudio`). Att ha en enda källa för typerna gör att
 * studions pose-editor kan producera samma struktur som built-in-övningarna
 * utan duplicerade type-definitioner.
 */
import * as THREE from "three";
import {
  HANG_DIST, H_THIGH, H_SHIN, H_TORSO, H_UPPER, H_LOWER, W_SHLDR,
} from "../components/Canvas3D/GymnastBody";

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
  rootRotX: number; rootRotY: number; rootRotZ: number;
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

/**
 * Trick-fönster: ögonblick i en övning där spelaren kan tjäna poäng genom
 * att trycka på trick-knappen exakt på rätt tid. Används av "Proffs"-läget
 * för att gradera släpp/fångst/landning. `t` är cykeltid i sekunder,
 * `windowMs` är toleransen ±. Default 250ms tolerans, 1.0× difficulty.
 */
export type TrickType = "release" | "catch" | "landing" | "twist";
export type TrickWindow = {
  t: number;
  type: TrickType;
  label?: string;
  windowMs?: number;
  difficulty?: number;
};

/**
 * Hold-zon: tidsintervall där gymnasten ska hållas stilla (joystick i mitten).
 * Spelaren samlar `pointsPerSec` × multiplikator per sekund stillsamt i zonen.
 * Reseta uppsamlad tid när spelaren rör joysticken eller scrubbar ut ur zonen.
 */
export type HoldZone = {
  tStart: number;
  tEnd: number;
  label?: string;
  pointsPerSec?: number;
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
  /** Tidpunkter i cykeln där spelaren kan tjäna poäng via trick-knappen. */
  tricks?: TrickWindow[];
  /** Statiska poser där spelaren samlar poäng genom att hålla stilla. */
  holdZones?: HoldZone[];
};

export const POSE_KEYS: (keyof Pose)[] = [
  "spineX", "spineZ", "headX", "headZ",
  "lShX", "lShZ", "lElX",
  "rShX", "rShZ", "rElX",
  "lHipX", "lHipZ", "lKnX",
  "rHipX", "rHipZ", "rKnX",
  "rootX", "rootY", "rootZ",
  "rootRotX", "rootRotY", "rootRotZ",
];

export const ZERO: Pose = {
  spineX: 0, spineZ: 0, headX: 0, headZ: 0,
  lShX: 0,  lShZ: 0,  lElX: 0,
  rShX: 0,  rShZ: 0,  rElX: 0,
  lHipX: 0, lHipZ: 0, lKnX: 0,
  rHipX: 0, rHipZ: 0, rKnX: 0,
  rootX: 0, rootY: 0, rootZ: 0,
  rootRotX: 0, rootRotY: 0, rootRotZ: 0,
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

// ─── FK-rigg för hand-lås ─────────────────────────────────────────────────────
// Bygger en minimal THREE.js-hierarki som speglar GymnastBody, så vi kan
// applicera en Pose och läsa ut handposition genom full kinematik. Behövs
// eftersom grepppunkten (händerna) flyttas av hela kedjan rootRotX → spineX/Z
// → shoulderX/Z → elbowX, inte bara av rootRotX+spineX. Utan FK skulle t.ex.
// en arm-bend mellan KFs skjuta handen bort från stången.
type FkRig = {
  root: THREE.Group;
  spine: THREE.Group;
  lSh: THREE.Group; lEl: THREE.Group; lHand: THREE.Object3D;
  rSh: THREE.Group; rEl: THREE.Group; rHand: THREE.Object3D;
};
let _fkRig: FkRig | null = null;
const _tmpL = new THREE.Vector3();
const _tmpR = new THREE.Vector3();

function getFkRig(): FkRig {
  if (_fkRig) return _fkRig;
  const root = new THREE.Group();
  const spine = new THREE.Group();
  root.add(spine);
  const mkArm = (side: -1 | 1): { sh: THREE.Group; el: THREE.Group; hand: THREE.Object3D } => {
    const sh = new THREE.Group();
    sh.position.set(side * W_SHLDR, H_TORSO * 0.87, 0);
    spine.add(sh);
    const el = new THREE.Group();
    el.position.set(0, -H_UPPER, 0);
    sh.add(el);
    const hand = new THREE.Object3D();
    hand.position.set(0, -H_LOWER, 0);
    el.add(hand);
    return { sh, el, hand };
  };
  const L = mkArm(-1);
  const R = mkArm(1);
  _fkRig = {
    root, spine,
    lSh: L.sh, lEl: L.el, lHand: L.hand,
    rSh: R.sh, rEl: R.el, rHand: R.hand,
  };
  return _fkRig;
}

/**
 * Låser rootY/rootZ så att händer (hang-bar) eller fötter (golv) sitter fast
 * när kroppen rör sig. För "hands" använder vi en verklig FK-beräkning över
 * hela armkedjan (root→spine→shoulder→elbow→hand) – INTE bara rootRotX – så
 * att ingen kroppsdel kan skjuta handen ur sitt läge mellan keyframes. Grepp-
 * punkten tillåts sitta BAR_R ut från stångcentrum längs hand-vektorn, så
 * handen traverserar en liten cirkel runt stången istället för att klistras
 * mot en exakt punkt.
 */
export function applyLock(pose: Pose, mode: LockMode): Pose {
  if (mode === "hands") {
    const r = getFkRig();
    r.root.position.set(0, 0, 0);
    r.root.rotation.set(pose.rootRotX, pose.rootRotY, pose.rootRotZ);
    r.spine.rotation.set(pose.spineX, 0, pose.spineZ);
    r.lSh.rotation.set(pose.lShX, 0, pose.lShZ);
    r.lEl.rotation.x = pose.lElX;
    r.rSh.rotation.set(pose.rShX, 0, pose.rShZ);
    r.rEl.rotation.x = pose.rElX;
    r.root.updateMatrixWorld(true);
    r.lHand.getWorldPosition(_tmpL);
    r.rHand.getWorldPosition(_tmpR);
    // Medel-hand: behandlar gymnasten som att greppet sitter mellan händerna.
    // Vid symmetrisk pose = identiskt med vänster/höger. Vid asymmetri fångar
    // medelvärdet det bästa gemensamma läge för bådas greppunkt.
    const midY = (_tmpL.y + _tmpR.y) * 0.5;
    const midZ = (_tmpL.z + _tmpR.z) * 0.5;
    // Greppriktning = hip→hand-mitt, normaliserad i Y-Z. BAR_R offsetar
    // greppet utåt från stångcentrum längs denna riktning.
    const len = Math.hypot(midY, midZ);
    const upY = len > 1e-6 ? midY / len : 1;
    const upZ = len > 1e-6 ? midZ / len : 0;
    const targetY = HANG_DIST + BAR_R * upY;
    const targetZ = 0 + BAR_R * upZ;
    return { ...pose, rootY: targetY - midY, rootZ: targetZ - midZ };
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
