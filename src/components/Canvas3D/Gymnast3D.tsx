/**
 * Gymnast3D – animerad FK-figur för 3D-vyn.
 *
 * ROOT = höfter.  Bålen sträcker sig UPPÅT; benen NEDÅT.
 * Kroppen renderas via delad <GymnastBody> – ansikte och tåspetsar mot −Z.
 * Häng-övningar: händerna låsta vid stången via pendel-förskjutning
 * (rootZ + rootY) som matchar rootRotX, så pivot är i greppspunkten.
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EquipmentType } from "../../types";
import {
  GymnastBody,
  H_TORSO, H_UPPER, H_LOWER, H_THIGH, H_SHIN, HANG_DIST,
  type BodyRefs,
} from "./GymnastBody";
import {
  type Pose, type KF, type ExerciseDef,
  ZERO, HANG_STRAIGHT, lerpPose, evalKF, evalExercise, pend,
} from "../../types/pose";
import { useCustomExercisesStore } from "../../store/useCustomExercisesStore";

// Re-exporter för bakåtkompatibilitet med moduler som importerar från Gymnast3D.
export type { Pose, KF, ExerciseDef };
export { ZERO, HANG_STRAIGHT, lerpPose, evalKF, evalExercise, pend };

// ─── Animationer ──────────────────────────────────────────────────────────────
const P = Math.PI;

// Armar ut åt sidan för balans (bom-stil)
const ARMS_SIDE: Partial<Pose> = { lShZ: -P * 0.28, rShZ: P * 0.28, lElX: P * 0.05, rElX: P * 0.05 };

export const BUILT_IN_EXERCISES: Record<string, ExerciseDef> = {

  // ── Räck ───────────────────────────────────────────────────────────────────

  // Kast bakåt (jättesving) – ROOT cirkulerar runt stången i YZ-planet.
  // 21 KFs importerade från studion. Kompakt helper (mk) undviker boilerplate
  // då bara spineX, hipX, rootY, rootZ och rootRotX varierar per KF – armarna
  // är sträckta (HANG_STRAIGHT) och lHipX = rHipX i hela svinget.
  "high-bar:giant-swing": (() => {
    const mk = (
      t: number, spineX: number, hipX: number,
      rootY: number, rootZ: number, rootRotX: number,
    ): KF => ({
      t,
      pose: { ...HANG_STRAIGHT, spineX, lHipX: hipX, rHipX: hipX, rootY, rootZ, rootRotX },
    });
    return {
      lockMode: "hands",
      kfs: [
        mk(0,     0,                       0,                        -0.05,  0,                    0),
        mk(0.08,  0.012360679774997897,   -0.027811529493745265,      0.01, -0.31,                 0.3141592653589793),
        mk(0.16,  0.023511410091698926,   -0.05290067270632258,       0.16, -0.58,                 0.6283185307179586),
        mk(0.24,  0.032360679774997896,   -0.07281152949374527,       0.39, -0.79,                 0.9424777960769379),
        mk(0.32,  0.038042260651806145,   -0.08559508646656382,       0.66, -0.9,                  1.2566370614359172),
        mk(0.4,   0.04,                   -0.09,                      0.95, -0.93,                 1.5707963267948966),
        mk(0.48,  0.038042260651806145,   -0.08559508646656383,       1.24, -0.89,                 1.8849555921538759),
        mk(0.56,  0.032360679774997896,   -0.07281152949374527,       1.49, -0.74,                 2.199114857512855),
        mk(0.64,  0.02351141009169893,    -0.05290067270632259,       1.68, -0.5295945123155185,   2.5132741228718345),
        mk(0.72,  0.0123606797749979,     -0.027811529493745275,      1.81, -0.2784243119318277,   2.827433388230814),
        mk(0.8,   4.898587196589413e-18,  -1.1021821192326179e-17,    1.85,  0,                    3.141592653589793),
        mk(0.88, -0.012360679774997909,   -0.027811529493745296,      1.8,   0.29,                 3.455751918948773),
        mk(0.96, -0.023511410091698923,   -0.05290067270632257,       1.67,  0.55,                 3.7699111843077517),
        mk(1.04, -0.032360679774997896,   -0.07281152949374525,       1.48,  0.75,                 4.084070449666731),
        mk(1.12, -0.038042260651806145,   -0.08559508646656382,       1.22,  0.89,                 4.39822971502571),
        mk(1.2,  -0.04,                   -0.09,                      0.93,  0.94,                 4.71238898038469),
        mk(1.28, -0.038042260651806145,   -0.08559508646656383,       0.64,  0.9,                  5.026548245743669),
        mk(1.36, -0.0323606797749979,     -0.07281152949374528,       0.37,  0.78,                 5.340707511102648),
        mk(1.44, -0.023511410091698937,   -0.0529006727063226,        0.15,  0.58,                 5.654866776461628),
        mk(1.52, -0.012360679774997907,   -0.02781152949374529,       0.01,  0.29,                 5.969026041820607),
        mk(1.6,  -9.797174393178826e-18,  -2.2043642384652358e-17,   -0.03,  0,                    6.283185307179586),
      ],
    };
  })(),

  // Kip – häng → pike → sving upp → stöd → häng
  // Definitionen nedan är editerad i Övningsstudion och importerad som-är.
  // `lockMode: "hands"` + per-KF `locked` flaggar att greppet ska fastna vid
  // stången genom FK under interpolation; stöd-fasen (t=2.04–2.27) markerar
  // KFs utan `locked` så rootY/rootZ där behandlas som fritt definierade.
  "high-bar:kip": {
    lockMode: "hands",
    kfs: [
      { t: 0, pose: { ...ZERO,
        lShX: 3.141592653589793, rShX: 3.141592653589793,
        rootY: -0.03 } },
      { t: 0.15, locked: true, pose: { ...ZERO,
        spineX: 0.226814692820414,
        lShX: 3.141592653589793, rShX: 3.141592653589793,
        lHipX: -0.133185307179586, rHipX: -0.133,
        rootY: 0.03, rootZ: 0.33,
        rootRotX: -0.593185307179586 } },
      { t: 0.3, locked: true, pose: { ...ZERO,
        lShX: 3.14681469282041, rShX: 3.141592653589793,
        lHipX: 0.307, rHipX: 0.307,
        rootY: 0.17, rootZ: -0.6,
        rootRotX: 0.676814692820414 } },
      { t: 0.675, locked: true, pose: { ...ZERO,
        spineX: -2.20318530717959,
        lShX: 1.83681469282041, rShX: 1.837,
        rootY: 0.21, rootZ: -0.28,
        rootRotX: 3.34681469282041 } },
      { t: 1.5875, locked: true, pose: { ...ZERO,
        spineX: -2.20318530717959,
        lShX: 1.83681469282041, rShX: 1.837,
        lHipX: -1.243, rHipX: -1.24318530717959,
        rootY: 0.43, rootZ: 0.59,
        rootRotX: 2.06681469282041 } },
      { t: 2.04375, pose: { ...ZERO,
        spineX: -2.20318530717959,
        lShX: 0.416814692820414, rShX: 0.417,
        lHipX: -1.97318530717959, rHipX: -1.973,
        rootY: 1.03, rootZ: 0.21,
        rootRotX: 2.06681469282041 } },
      { t: 2.1578125, pose: { ...ZERO,
        spineX: -2.20318530717959,
        lShX: 0.227, rShX: 0.226814692820414,
        lHipX: -2.15318530717959, rHipX: -2.153,
        rootY: 1.05, rootZ: 0.1,
        rootRotX: 2.00681469282041 } },
      { t: 2.271875, pose: { ...ZERO,
        spineX: -2.20318530717959,
        lShX: 0.416814692820414, rShX: 0.417,
        lHipX: -1.97318530717959, rHipX: -1.973,
        rootY: 1.03, rootZ: 0.21,
        rootRotX: 2.06681469282041 } },
      { t: 2.5, locked: true, pose: { ...ZERO,
        lShX: 3.141592653589793, rShX: 3.141592653589793,
        rootY: -0.03 } },
    ],
  },

  // Enkel sving räck – 3 KFs importerade från studion. lockMode: hands
  // håller greppet vid stången, rootRotX driver själva pendeln och spineX +
  // hipX ger liten kroppsaktivering i topparna.
  "high-bar:swing": {
    lockMode: "hands",
    kfs: [
      { t: 0, pose: { ...HANG_STRAIGHT,
        spineX: -0.443185307179586,
        lHipX: 0.3141592653589793, rHipX: 0.3141592653589793,
        rootY: 0.10380186235280231, rootZ: -0.4599845049891373,
        rootRotX: 0.9424777960769379 } },
      { t: 0.9, pose: { ...HANG_STRAIGHT,
        spineX: 0.296814692820414,
        lHipX: -0.25132741228718347, rHipX: -0.25132741228718347,
        rootY: 0.15472014925722882, rootZ: 0.5700257767912621,
        rootRotX: -0.9424777960769379 } },
      { t: 1.8, pose: { ...HANG_STRAIGHT,
        spineX: -0.047123889803846894,
        lHipX: 0.3141592653589793, rHipX: 0.3141592653589793,
        rootY: 0.31, rootZ: -0.73,
        rootRotX: 0.9424777960769379 } },
    ],
  },

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

  // Ojämna barr – pendel vid övre barren. 3 KFs importerade från studion,
  // lockMode: hands håller greppet vid stången under hela rörelsen.
  "uneven-bars:swing": {
    lockMode: "hands",
    kfs: [
      { t: 0, pose: { ...HANG_STRAIGHT,
        lHipX: 0.3141592653589793, rHipX: 0.3141592653589793,
        rootY: 0.31, rootZ: -1.42,
        rootRotX: 0.8796459430051422 } },
      { t: 0.9, pose: { ...HANG_STRAIGHT,
        lHipX: -0.21991148575128555, rHipX: -0.21991148575128555,
        rootY: 0.3, rootZ: 0.02,
        rootRotX: -0.8796459430051422 } },
      { t: 1.8, pose: { ...HANG_STRAIGHT,
        lHipX: 0.3141592653589793, rHipX: 0.3141592653589793,
        rootY: 0.31, rootZ: -1.44,
        rootRotX: 0.8796459430051422 } },
    ],
  },

  // ── Bom ────────────────────────────────────────────────────────────────────

  // Gång bom – gymnasten rör sig framåt längs bommen (ansikte mot −Z lokalt).
  // Positiv hipX = ben framåt (mot −Z). Negativ knX = naturlig knäböjning i svingen.
  "beam:walk": {
    baseRotY: P / 2,  // vänd gymnasten så den tittar längs bommen (−X i världen)
    advance: 0.65,    // 0.65 m per 2 s cykel ≈ 0.33 m/s
    range: 3.5,
    kfs: [
      // Höger fot framme, vänster bak (contra-lateral arm: vänster fram)
      { t: 0,    pose: { ...ZERO,
          rHipX: P*0.22, lHipX:-P*0.18, lKnX:-P*0.12,
          lShX: P*0.10, rShX:-P*0.08,
          ...ARMS_SIDE,
          spineZ: 0.025, rootY:-0.01 } },
      // Transition – vänster ben svänger framåt, knä böjs
      { t: 0.5,  pose: { ...ZERO,
          rHipX:-P*0.08, lHipX: P*0.04, lKnX:-P*0.22,
          rShX: P*0.04, lShX:-P*0.04,
          ...ARMS_SIDE,
          spineZ:-0.02, rootY: 0.02 } },
      // Vänster fot framme, höger bak (contra-lateral arm: höger fram)
      { t: 1.0,  pose: { ...ZERO,
          lHipX: P*0.22, rHipX:-P*0.18, rKnX:-P*0.12,
          rShX: P*0.10, lShX:-P*0.08,
          ...ARMS_SIDE,
          spineZ:-0.025, rootY:-0.01 } },
      // Transition – höger ben svänger framåt, knä böjs
      { t: 1.5,  pose: { ...ZERO,
          lHipX:-P*0.08, rHipX: P*0.04, rKnX:-P*0.22,
          lShX: P*0.04, rShX:-P*0.04,
          ...ARMS_SIDE,
          spineZ: 0.02, rootY: 0.02 } },
      // Loop
      { t: 2.0,  pose: { ...ZERO,
          rHipX: P*0.22, lHipX:-P*0.18, lKnX:-P*0.12,
          lShX: P*0.10, rShX:-P*0.08,
          ...ARMS_SIDE,
          spineZ: 0.025, rootY:-0.01 } },
    ],
  },

  // Hopp bom – knäböj inför hopp + mjuk landning (−Z-konvention)
  "beam:jump": { baseRotY: P / 2, kfs: [
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 0.25, pose: { ...ZERO, lHipX: P*0.22, rHipX: P*0.22, lKnX:-P*0.32, rKnX:-P*0.32,
                       spineX:-P*0.08,
                       rootY:-0.06, lShZ:-P*0.20, rShZ:P*0.20 } },
    { t: 0.50, pose: { ...ZERO, rootY:0.28,
                       lShX:-P*0.6, rShX:-P*0.6, lShZ:-P*0.10, rShZ:P*0.10,
                       spineX:-P*0.03, headX:-P*0.05 } },
    { t: 0.75, pose: { ...ZERO, rootY:0.20,
                       lShX:-P*0.4, rShX:-P*0.4, lShZ:-P*0.15, rShZ:P*0.15 } },
    { t: 1.05, pose: { ...ZERO, lHipX: P*0.20, rHipX: P*0.20, lKnX:-P*0.30, rKnX:-P*0.30,
                       spineX:-P*0.08,
                       rootY:-0.05, lShZ:-P*0.22, rShZ:P*0.22 } },
    { t: 1.40, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },

  // Stå (bom) – armar ut åt sidan, subtil andning
  "beam:stand": { baseRotY: P / 2, kfs: [
    { t: 0,   pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 2.0, pose: { ...ZERO, ...ARMS_SIDE, spineX:P*0.015, rootY:0.008, spineZ:0.01 } },
    { t: 4.0, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },

  // Arabesque – vänster ben bak (höger = stödben), torso framåt, huvud lyft
  //   Konvention (ansikte −Z): negativ hipX = ben bakåt (+Z)
  "beam:arabesque": { baseRotY: P / 2, kfs: [
    { t: 0,   pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 0.70, pose: { ...ZERO,
        lHipX: -P*0.50, lKnX: 0,
        rHipX: -P*0.04,
        spineX: -P*0.18, spineZ: 0.02,
        lShX: -P*0.70, lShZ:-P*0.10, lElX: P*0.05,
        rShZ: P*0.42, rShX:-P*0.04, rElX: P*0.04,
        headX: P*0.12,
        rootY: 0.01 } },
    { t: 2.80, pose: { ...ZERO,
        lHipX: -P*0.52, lKnX: 0,
        rHipX: -P*0.04,
        spineX: -P*0.18, spineZ: 0.02,
        lShX: -P*0.72, lShZ:-P*0.10, lElX: P*0.05,
        rShZ: P*0.40, rShX:-P*0.04, rElX: P*0.04,
        headX: P*0.12,
        rootY: 0.01 } },
    { t: 3.50, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },

  // Knähopp (tuck jump) – knäböj → tuck (knän mot bröst) → landning
  "beam:tuck-jump": { baseRotY: P / 2, kfs: [
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 0.22, pose: { ...ZERO, lHipX: P*0.20, rHipX: P*0.20, lKnX:-P*0.32, rKnX:-P*0.32,
                       spineX:-P*0.08,
                       rootY:-0.07, lShZ:-P*0.18, rShZ:P*0.18 } },
    { t: 0.45, pose: { ...ZERO, rootY:0.30,
                       lShX:-P*0.5, rShX:-P*0.5, lShZ:-P*0.06, rShZ:P*0.06,
                       spineX:-P*0.03 } },
    // Tuck i luften: lår upp-framåt (+hipX stor), skenben vikta bakåt under (−knX stor)
    { t: 0.62, pose: { ...ZERO, lHipX: P*0.85, rHipX: P*0.85, lKnX:-P*0.95, rKnX:-P*0.95,
                       spineX:-P*0.18, rootY:0.34,
                       lShX:-P*0.30, rShX:-P*0.30, lElX:P*0.45, rElX:P*0.45 } },
    { t: 0.85, pose: { ...ZERO, rootY:0.15,
                       lShX:-P*0.3, rShX:-P*0.3, lShZ:-P*0.12, rShZ:P*0.12 } },
    { t: 1.05, pose: { ...ZERO, lHipX: P*0.20, rHipX: P*0.20, lKnX:-P*0.30, rKnX:-P*0.30,
                       spineX:-P*0.08,
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
    // Hoppförberedelse på golvet – knäböj (lår något framåt, skenben vertikalt)
    { t: 0.40, pose: { ...ZERO,
        lHipX: P*0.22, rHipX: P*0.22, lKnX: -P*0.35, rKnX: -P*0.35,
        spineX: -P*0.10,
        rootY: -1.30, rootZ: 0.55,
        lShZ: -P*0.18, rShZ: P*0.18 } },
    // I luften – hoppar upp mot bommen (armar upp)
    { t: 0.75, pose: { ...ZERO,
        rootY: 0.10, rootZ: 0.15,
        lShX: -P*0.30, rShX: -P*0.30,
        lShZ: -P*0.10, rShZ: P*0.10 } },
    // Landning sittande på bommen – benen framåt över bommen, knän naturligt böjda
    { t: 1.20, pose: { ...ZERO,
        lHipX: P*0.50, rHipX: P*0.50,
        lKnX: -P*0.45, rKnX: -P*0.45,
        spineX: -P*0.05, rootY: -0.55, ...ARMS_SIDE } },

    // ── Fas 3: Ena benet över → ridsittande, armar ut ───────────────────
    //   Höger ben fortsatt framåt, vänster ben svingas bakåt (straddle)
    { t: 2.00, pose: { ...ZERO,
        lHipX: -P*0.35, rHipX: P*0.40,
        lKnX: -P*0.25, rKnX: -P*0.20,
        rootY: -0.55, ...ARMS_SIDE } },
    { t: 2.60, pose: { ...ZERO,
        lHipX: -P*0.32, rHipX: P*0.42,
        lKnX: -P*0.22, rKnX: -P*0.18,
        rootY: -0.55, ...ARMS_SIDE } },

    // ── Fas 4: Vipp till huksittande, händer i midjan ───────────────────
    //   Djup huk: lår upp-framåt, skenben ≈ vertikalt
    { t: 3.20, pose: { ...ZERO,
        lHipX: P*0.55, rHipX: P*0.55,
        lKnX: -P*0.55, rKnX: -P*0.55,
        spineX: -P*0.18, rootY: -0.35,
        lShZ: -P*0.12, rShZ: P*0.12,
        lElX: P*0.55, rElX: P*0.55 } },

    // ── Fas 5: Gå två steg på huk, händer i midjan ─────────────────────
    //   (rootX negativ = framåt i blickriktningen −X efter baseRotY=π/2)
    { t: 3.90, pose: { ...ZERO,
        lHipX: P*0.50, rHipX: P*0.60,
        lKnX: -P*0.58, rKnX: -P*0.48,
        spineX: -P*0.18, rootY: -0.33, rootX: -0.25,
        lShZ: -P*0.12, rShZ: P*0.12,
        lElX: P*0.55, rElX: P*0.55 } },
    { t: 4.60, pose: { ...ZERO,
        lHipX: P*0.60, rHipX: P*0.50,
        lKnX: -P*0.48, rKnX: -P*0.58,
        spineX: -P*0.18, rootY: -0.33, rootX: -0.50,
        lShZ: -P*0.12, rShZ: P*0.12,
        lElX: P*0.55, rElX: P*0.55 } },

    // ── Fas 6: Sträck benen → pikstående, armar ut ──────────────────────
    //   Pik = framåtvikt överkropp: spineX negativ (huvudet mot −Z/ansiktet)
    { t: 5.20, pose: { ...ZERO,
        spineX: -P*0.50, rootY: -0.06, rootX: -0.55,
        ...ARMS_SIDE } },
    { t: 5.80, pose: { ...ZERO,
        spineX: -P*0.52, rootY: -0.06, rootX: -0.55,
        ...ARMS_SIDE } },

    // ── Fas 7: Händer på bom, gå med fötter och händer (björngång) ──────
    //   Framåtlutning (spineX negativ) + armar sträckta ned mot bommen
    { t: 6.30, pose: { ...ZERO,
        spineX: -P*0.55,
        lShX: P*0.50, rShX: P*0.50,
        lElX: P*0.10, rElX: P*0.10,
        rootY: -0.08, rootX: -0.60 } },
    { t: 6.90, pose: { ...ZERO,
        spineX: -P*0.55,
        lShX: P*0.55, rShX: P*0.42,
        lElX: P*0.10, rElX: P*0.10,
        lHipX: P*0.10, rHipX: -P*0.06, rKnX:-P*0.10,
        rootY: -0.08, rootX: -0.80 } },
    { t: 7.50, pose: { ...ZERO,
        spineX: -P*0.55,
        lShX: P*0.42, rShX: P*0.55,
        lElX: P*0.10, rElX: P*0.10,
        lHipX: -P*0.06, rHipX: P*0.10, lKnX:-P*0.10,
        rootY: -0.08, rootX: -1.00 } },

    // ── Fas 8: Res upp, sträckt kropp, händer bakom ryggen ──────────────
    { t: 8.10, pose: { ...ZERO,
        spineX: P*0.10,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: -1.05 } },
    { t: 8.60, pose: { ...ZERO,
        lShX: P*0.18, rShX: P*0.18,
        lElX: P*0.45, rElX: P*0.45,
        lShZ: P*0.04, rShZ: -P*0.04,
        rootX: -1.05 } },

    // ── Fas 9: Gå 2 steg med peka tå ────────────────────────────────────
    //   Positiv hipX = ben framåt (−Z lokalt). Negativ knX = naturlig böjning.
    { t: 9.30, pose: { ...ZERO,
        rHipX: -P*0.16, lHipX: P*0.10, lKnX:-P*0.06,
        ...ARMS_SIDE,
        rootX: -1.30 } },
    { t: 10.00, pose: { ...ZERO,
        lHipX: -P*0.16, rHipX: P*0.10, rKnX:-P*0.06,
        ...ARMS_SIDE,
        rootX: -1.55 } },

    // ── Fas 10: Ytterligare 2 steg med tå och knä ───────────────────────
    { t: 10.70, pose: { ...ZERO,
        rHipX: -P*0.25, lHipX: P*0.08, lKnX:-P*0.12,
        ...ARMS_SIDE,
        rootX: -1.80 } },
    { t: 11.40, pose: { ...ZERO,
        lHipX: -P*0.25, rHipX: P*0.08, rKnX:-P*0.12,
        ...ARMS_SIDE,
        rootX: -2.05 } },

    // ── Fas 11: Steg ihop till samlat stående ───────────────────────────
    { t: 11.80, pose: { ...ZERO, ...ARMS_SIDE, rootX: -2.10 } },

    // ── Fas 12: Avhopp – ljushopp med armdrag, kontrollerad landning ────
    //   Knäböj inför hopp: lår framåt (+hipX), skenben vertikalt (−knX)
    { t: 12.20, pose: { ...ZERO,
        lHipX: P*0.18, rHipX: P*0.18, lKnX: -P*0.30, rKnX: -P*0.30,
        spineX: -P*0.08,
        rootY: -0.05, lShZ: -P*0.18, rShZ: P*0.18, rootX: -2.10 } },
    { t: 12.50, pose: { ...ZERO,
        rootY: 0.35,
        lShX: -P*0.75, rShX: -P*0.75,
        spineX: -P*0.02,
        rootX: -2.10, rootZ: 0.15 } },
    { t: 12.80, pose: { ...ZERO,
        rootY: 0.15,
        lShX: -P*0.80, rShX: -P*0.80,
        rootX: -2.10, rootZ: 0.45 } },
    // Landning – mjuk mottagning med böjda knän
    { t: 13.10, pose: { ...ZERO,
        lHipX: P*0.22, rHipX: P*0.22, lKnX: -P*0.38, rKnX: -P*0.38,
        spineX: -P*0.10,
        rootY: -1.20,
        lShZ: -P*0.22, rShZ: P*0.22,
        rootX: -2.10, rootZ: 0.55 } },
    { t: 13.50, pose: { ...ZERO,
        rootY: -1.25, ...ARMS_SIDE,
        rootX: -2.10, rootZ: 0.55 } },
    { t: 14.00, pose: { ...ZERO,
        rootY: -1.25, ...ARMS_SIDE,
        rootX: -2.10, rootZ: 0.55 } },
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

  // Kors – armar åt sidan, rootY kompenserar för att händerna är vid axelhöjd (ej ovanför)
  "rings:cross": { kfs: [
    { t: 0,   pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.51 } },
    { t: 2.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.10, rElX:P*0.10, rootY:0.54, spineX:P*0.02 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-P*0.48, rShZ: P*0.48, lElX:P*0.06, rElX:P*0.06, rootY:0.51 } },
  ] },

  // ── Fristående ─────────────────────────────────────────────────────────────

  // Handstående – 3 KFs importerade från studion. lockMode: hands håller
  // händerna mot golvet så kroppen balanserar upp-och-ned. Liten
  // spineX-oscillation ger en levande "vågning".
  "floor:handstand": {
    lockMode: "hands",
    kfs: [
      { t: 0, pose: { ...ZERO,
        spineX: -0.073185307179586,
        lShX: -3.141592653589793, rShX: -3.141592653589793,
        rootY: 0.03,
        rootRotX: 3.141592653589793 } },
      { t: 0.25, pose: { ...ZERO,
        spineX: 0.076814692820414,
        lShX: -3.141592653589793, rShX: -3.141592653589793,
        rootY: 0.029756551564592337, rootZ: 0.13415392700899345,
        rootRotX: 3.141592653589793 } },
      { t: 0.5, pose: { ...ZERO,
        spineX: -0.073185307179586,
        lShX: -3.141592653589793, rShX: -3.141592653589793,
        rootY: 0.03,
        rootRotX: 3.141592653589793 } },
    ],
  },

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

  // Handstående på hoppbord – 3 KFs importerade från studion. lockMode
  // hands håller händerna mot bordet, spineX + rootZ-vågningen ger en
  // levande balansering ovanpå.
  "vault:handstand": {
    lockMode: "hands",
    kfs: [
      { t: 0, pose: { ...ZERO,
        spineX: -0.09424777960769379,
        lShX: -3.141592653589793, rShX: -3.141592653589793,
        rootY: 0.17,
        rootRotX: 3.141592653589793 } },
      { t: 0.5, pose: { ...ZERO,
        spineX: 0.076814692820414,
        lShX: -3.141592653589793, rShX: -3.141592653589793,
        rootY: 0.17133316519169073, rootZ: 0.1529426709093971,
        rootRotX: 3.141592653589793 } },
      { t: 1, pose: { ...ZERO,
        spineX: -0.09424777960769379,
        lShX: -3.141592653589793, rShX: -3.141592653589793,
        rootY: 0.17,
        rootRotX: 3.141592653589793 } },
    ],
  },

  // ── Trampett ───────────────────────────────────────────────────────────────

  "mini-tramp:bounce": { kfs: [
    { t: 0,    pose: { ...ZERO } },
    { t: 0.20, pose: { ...ZERO, lHipX: P*0.18, rHipX: P*0.18, lKnX:-P*0.28, rKnX:-P*0.28,
                       spineX:-P*0.06,
                       rootY:-0.06, lShZ:-P*0.10, rShZ:P*0.10 } },
    { t: 0.45, pose: { ...ZERO, rootY:0.32,
                       lShX:-P*0.4, rShX:-P*0.4, lShZ:-P*0.10, rShZ:P*0.10,
                       spineX:-P*0.02 } },
    { t: 0.70, pose: { ...ZERO, rootY:0.15,
                       lShX:-P*0.2, rShX:-P*0.2, lShZ:-P*0.12, rShZ:P*0.12 } },
    { t: 0.85, pose: { ...ZERO, lHipX: P*0.16, rHipX: P*0.16, lKnX:-P*0.26, rKnX:-P*0.26,
                       spineX:-P*0.06,
                       rootY:-0.05, lShZ:-P*0.08, rShZ:P*0.08 } },
    { t: 1.0,  pose: { ...ZERO } },
  ] },

  // ── Plint ──────────────────────────────────────────────────────────────────

  "plinth:stand": { kfs: [
    { t: 0,   pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06, lElX:P*0.04, rElX:P*0.04 } },
    { t: 2.0, pose: { ...ZERO, spineX:P*0.015, lShZ: 0.04, rShZ:-0.04, rootY:0.008 } },
    { t: 4.0, pose: { ...ZERO, lShZ:-0.06, rShZ: 0.06, lElX:P*0.04, rElX:P*0.04 } },
  ] },

  // ── Fristående golv-tricks ─────────────────────────────────────────────────
  //   Seed-KFs. Riggen saknar root-roll (ingen rotRotZ) så hjulning
  //   approximeras via spineZ + rootY-båge + rootRotY-vändning. Användaren
  //   finjusterar via studion (override).

  // Kullerbytta – 7 KFs importerade från studion, t-värden ×3 från import
  // så duration ~1.37s istället för 0.46s (i paritet med cartwheel/tuck-jump
  // som körs i realtid). Stående → huk → huvud ned → rullning via rootRotX
  // = -2π → resning. rootZ driver ~2.6 m framåt under rullningen.
  "floor:forward-roll": { kfs: [
    { t: 0, pose: { ...ZERO,
      lShZ: -0.143185307179586, lElX: 0.15707963267948966,
      rShZ:  0.143185307179586, rElX: 0.15707963267948966 } },
    { t: 0.375, pose: { ...ZERO,
      spineX: -0.953185307179586,
      lShX: 1.53681469282041, lShZ: -0.143185307179586, lElX: 0.506814692820414,
      rShX: 1.53681469282041, rShZ:  0.143185307179586, rElX: 0.506814692820414,
      lKnX: -0.873185307179586, rKnX: -0.873185307179586,
      rootY: -0.25, rootZ: -0.42,
      rootRotX: -0.143185307179586 } },
    { t: 0.5625, pose: { ...ZERO,
      spineX: -1.02318530717959,
      headX: -0.583185307179586,
      lShX: 1.38681469282041, lShZ: -0.073185307179586, lElX: 0.876814692820414,
      rShX: 1.38681469282041, rShZ:  0.073185307179586, rElX: 0.876814692820414,
      lHipX: 0.946814692820414, rHipX: 0.946814692820414,
      lKnX: -2.04318530717959, rKnX: -2.04318530717959,
      rootY: -0.17, rootZ: -0.7,
      rootRotX: -0.653185307179586 } },
    { t: 0.75, pose: { ...ZERO,
      spineX: -0.6283185307179586,
      lShX: 1.38681469282041, lElX: 1.97681469282041,
      rShX: 1.38681469282041, rElX: 1.97681469282041,
      lHipX: 2.0420352248333655, rHipX: 2.0420352248333655,
      lKnX: -2.356194490192345, rKnX: -2.356194490192345,
      rootY: -1.81, rootZ: -1.26,
      rootRotX: -1.90318530717959 } },
    { t: 1.2, pose: { ...ZERO,
      spineX: -2.12318530717959,
      lShX: -1.02318530717959, lShZ: -3.21318530717959, lElX: -0.143185307179586,
      rShX: -1.02318530717959, rShZ:  3.21318530717959, rElX: -0.143185307179586,
      lHipX: 0.366814692820414, rHipX: 0.366814692820414,
      lKnX: -2.77318530717959, rKnX: -2.77318530717959,
      rootY: -1.81, rootZ: -2.44,
      rootRotX: -4.09318530717959 } },
    { t: 1.3125, pose: { ...ZERO,
      spineX: -0.143185307179586,
      lShX: -1.02318530717959, lShZ: -3.21318530717959, lElX: -0.143185307179586,
      rShX: -1.02318530717959, rShZ:  3.21318530717959, rElX: -0.143185307179586,
      lHipX: -0.143185307179586, rHipX: -0.143185307179586,
      lKnX: -0.073185307179586, rKnX: -0.073185307179586,
      rootY: -1.81, rootZ: -2.62,
      rootRotX: -6.06318530717959 } },
    { t: 1.36875, pose: { ...ZERO,
      spineX: -0.143185307179586,
      lShX: -3.14318530717959, lShZ: -3.07318530717959, lElX: -0.143185307179586,
      rShX: -3.14318530717959, rShZ:  3.07318530717959, rElX: -0.143185307179586,
      lHipX: -0.143185307179586, rHipX: -0.143185307179586,
      lKnX: -0.073185307179586, rKnX: -0.073185307179586,
      rootY: -1.81, rootZ: -2.62,
      rootRotX: -6.06318530717959 } },
  ] },

  // Hjulning – 7 KFs importerade från studion. rootRotZ driver sid-rotationen
  // kring gymnastens längdaxel, rootRotY vrider in ansiktet i färdriktningen
  // under själva svängen, rootZ driver förflyttning ~3 m framåt. Sista KF
  // landar med spineZ/hipZ nollställda så gymnasten står rakt efter hjulet.
  "floor:cartwheel": { kfs: [
    { t: 0, pose: { ...ZERO,
      lShX: -3.16318530717959, lShZ: -0.47123889803846897,
      rShX: -3.16318530717959, rShZ:  0.47123889803846897 } },
    { t: 0.0875, pose: { ...ZERO,
      lShX: -3.72318530717959, lShZ: -0.146814692820414,
      rShX: -3.16318530717959, rShZ:  0.47123889803846897,
      lHipX: 0.946814692820414, lHipZ: 0.223185307179586,
      rootY: -0.49, rootZ: -0.24,
      rootRotX: -0.363185307179586, rootRotY: -0.073185307179586 } },
    { t: 0.175, pose: { ...ZERO,
      spineZ: 0.966814692820414,
      lShX: -3.16318530717959, lShZ: -1.33318530717959,
      rShX: -3.16318530717959, rShZ:  0.47123889803846897,
      lHipZ: -0.323185307179586,
      rHipZ:  1.87681469282041,
      rootZ: -0.63,
      rootRotY: -1.60318530717959, rootRotZ: 0.416814692820414 } },
    { t: 0.35, pose: { ...ZERO,
      spineZ: 0.226814692820414,
      lShX: -3.25318530717959, lShZ: -0.323185307179586,
      rShX: -3.44318530717959, rShZ: -0.043185307179586,
      lHipZ: 0.046814692820414,
      rHipZ: 0.966814692820414,
      rootY: -0.52, rootZ: -1.19,
      rootRotY: -1.60318530717959, rootRotZ: 2.61681469282041 } },
    { t: 0.7, pose: { ...ZERO,
      spineZ: 0.226814692820414,
      lShX: -3.25318530717959, lShZ: -0.323185307179586,
      rShX: -3.34318530717959, rShZ:  0.596814692820414,
      lHipZ: 0.316814692820414,
      rHipZ: 1.32681469282041,
      rootY: 0.24, rootZ: -1.88,
      rootRotY: -1.60318530717959, rootRotZ: 3.43681469282041 } },
    { t: 1.05, pose: { ...ZERO,
      spineZ: 0.966814692820414,
      lShX: -3.16318530717959, lShZ: -1.14318530717959,
      rShX: -3.34318530717959, rShZ:  1.87681469282041,
      lHipZ: 0.316814692820414,
      rHipZ: 1.60681469282041,
      rootY: 0.07, rootZ: -2.41,
      rootRotY: -1.53318530717959, rootRotZ: 4.17681469282041 } },
    { t: 1.4, pose: { ...ZERO,
      lShX: -3.16318530717959, lShZ: -2.89318530717959,
      rShX: -3.16318530717959, rShZ:  2.79681469282041,
      rootZ: -3,
      rootRotZ: 6.27681469282041 } },
  ] },

  // Knähopp fristående (som beam:tuck-jump men på golv utan baseRotY)
  "floor:tuck-jump": { kfs: [
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE } },
    { t: 0.20, pose: { ...ZERO, lHipX: P*0.20, rHipX: P*0.20, lKnX:-P*0.32, rKnX:-P*0.32,
                       spineX:-P*0.08, rootY:-0.07,
                       lShZ:-P*0.18, rShZ:P*0.18 } },
    { t: 0.40, pose: { ...ZERO, rootY: 0.30,
                       lShX:-P*0.5, rShX:-P*0.5, lShZ:-P*0.06, rShZ:P*0.06,
                       spineX:-P*0.03 } },
    // Tuck
    { t: 0.55, pose: { ...ZERO, lHipX: P*0.85, rHipX: P*0.85, lKnX:-P*0.95, rKnX:-P*0.95,
                       spineX:-P*0.18, rootY: 0.34,
                       lShX:-P*0.30, rShX:-P*0.30, lElX: P*0.45, rElX: P*0.45 } },
    { t: 0.75, pose: { ...ZERO, rootY: 0.15,
                       lShX:-P*0.3, rShX:-P*0.3, lShZ:-P*0.12, rShZ: P*0.12 } },
    // Landning
    { t: 0.95, pose: { ...ZERO, lHipX: P*0.18, rHipX: P*0.18, lKnX:-P*0.28, rKnX:-P*0.28,
                       spineX:-P*0.06, rootY:-0.05,
                       lShZ:-P*0.20, rShZ: P*0.20 } },
    { t: 1.25, pose: { ...ZERO, ...ARMS_SIDE } },
  ] },
};

// Bakåtkompatibelt alias
export const EXERCISES = BUILT_IN_EXERCISES;

/**
 * Hook som slår ihop built-in-övningar med eventuella custom overrides
 * från `useCustomExercisesStore`. Custom vinner när id:t matchar ett
 * built-in-id, så användaren kan justera t.ex. bom-stegserien utan att
 * röra koden.
 */
export function useExerciseDef(id: string): ExerciseDef | undefined {
  const customDef = useCustomExercisesStore((s) => s.customDefs[id]);
  if (customDef) return customDef;
  return BUILT_IN_EXERCISES[id];
}

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

// ─── Huvud-komponent ─────────────────────────────────────────────────────────
type Props = {
  exerciseId: string;
  color?: string;
  equipmentType: EquipmentType;
};

export function Gymnast3D({ exerciseId, color = "#C2185B", equipmentType }: Props) {
  const SKIN = "#E8C99A";
  const HAIR = "#2d1a08";
  const customDef = useExerciseDef(exerciseId);
  const fallback  = BUILT_IN_EXERCISES["floor:stand"]!;
  const def  = customDef ?? fallback;
  const kfs  = def.kfs;
  const mt   = mountType(exerciseId);
  const pH   = equipmentType.physicalHeightM;

  // ROOT (höfter) basposition i redskaps-lokal Y
  const kind = equipmentType.detail?.kind ?? "";
  const baseY = (() => {
    if (mt === "hang-bar") {
      // Ringar: greppet är vid ringens underkant = physicalHeightM - 0.18
      if (kind === "rings" || kind === "rings-free")
        return pH - 0.18 - HANG_DIST;
      // Barr-baserade: Equipment3D lägger till 0.04 m basplatta som inte ingår i pH
      return pH + 0.04 - HANG_DIST;
    }
    if (mt === "support-bar")  return pH + H_UPPER + H_LOWER - H_TORSO * 0.85;
    return pH + H_THIGH + H_SHIN;
  })();

  // Leds-refs
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

  useFrame(({ clock }) => {
    const raw = clock.getElapsedTime();
    const p = evalExercise(def, raw);

    // Basrotation – vrider gymnasten mot redskapets längdriktning
    if (def.baseRotY) p.rootRotY += def.baseRotY;

    // Framåtrörelse (ping-pong) för gång-övningar.
    // Ansiktet pekar lokal −Z → världens −X efter baseRotY=π/2.
    // Vi negerar rootX så gymnasten rör sig i sin blickriktning.
    if (def.advance && def.advance > 0) {
      const dur = kfs[kfs.length - 1].t;
      const dist = (raw / dur) * def.advance;
      const totalRange = def.range ?? 3.0;
      const period = totalRange * 2;
      const phase = dist % period;
      if (phase <= totalRange) {
        p.rootX -= phase - totalRange / 2;
      } else {
        p.rootX -= (period - phase) - totalRange / 2;
        p.rootRotY += P; // vänd 180° för returvarvet
      }
    }

    if (rootRef.current) {
      rootRef.current.position.set(p.rootX, baseY + p.rootY, p.rootZ);
      rootRef.current.rotation.x = p.rootRotX;
      rootRef.current.rotation.y = p.rootRotY;
      rootRef.current.rotation.z = p.rootRotZ;
    }
    const r = bodyRefs;
    if (r.spineRef.current) { r.spineRef.current.rotation.x = p.spineX; r.spineRef.current.rotation.z = p.spineZ; }
    if (r.headRef.current)  { r.headRef.current.rotation.x  = p.headX;  r.headRef.current.rotation.z  = p.headZ; }
    if (r.lShRef.current)   { r.lShRef.current.rotation.x = p.lShX; r.lShRef.current.rotation.z = p.lShZ; }
    if (r.lElRef.current)     r.lElRef.current.rotation.x = p.lElX;
    if (r.rShRef.current)   { r.rShRef.current.rotation.x = p.rShX; r.rShRef.current.rotation.z = p.rShZ; }
    if (r.rElRef.current)     r.rElRef.current.rotation.x = p.rElX;
    if (r.lHipRef.current)  { r.lHipRef.current.rotation.x = p.lHipX; r.lHipRef.current.rotation.z = p.lHipZ; }
    if (r.lKnRef.current)     r.lKnRef.current.rotation.x  = p.lKnX;
    if (r.rHipRef.current)  { r.rHipRef.current.rotation.x = p.rHipX; r.rHipRef.current.rotation.z = p.rHipZ; }
    if (r.rKnRef.current)     r.rKnRef.current.rotation.x  = p.rKnX;
  });

  return (
    <group ref={rootRef} position={[0, baseY, 0]}>
      <GymnastBody color={color} skin={SKIN} hair={HAIR} refs={bodyRefs} />
    </group>
  );
}
