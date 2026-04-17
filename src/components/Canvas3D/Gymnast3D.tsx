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
  ZERO, HANG_STRAIGHT, lerpPose, evalKF, pend,
} from "../../types/pose";
import { useCustomExercisesStore } from "../../store/useCustomExercisesStore";

// Re-exporter för bakåtkompatibilitet med moduler som importerar från Gymnast3D.
export type { Pose, KF, ExerciseDef };
export { ZERO, HANG_STRAIGHT, lerpPose, evalKF, pend };

// ─── Animationer ──────────────────────────────────────────────────────────────
const P = Math.PI;

// Armar ut åt sidan för balans (bom-stil)
const ARMS_SIDE: Partial<Pose> = { lShZ: -P * 0.28, rShZ: P * 0.28, lElX: P * 0.05, rElX: P * 0.05 };

export const BUILT_IN_EXERCISES: Record<string, ExerciseDef> = {

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
  // Konvention (ansikte −Z): positiv hipX = ben framåt, negativ knX = naturlig böjning
  "high-bar:kip": { kfs: [
    // Häng
    { t: 0,    pose: { ...HANG_STRAIGHT } },
    // Liten baksving (fötter bakåt = +Z → positiv rootRotX)
    { t: 0.30, pose: { ...HANG_STRAIGHT,
        rootRotX: P*0.15, ...pend(P*0.15) } },
    // Framsving + pike (tårna fram mot stången, höfter vikta kraftigt fram)
    { t: 0.75, pose: { ...HANG_STRAIGHT,
        lHipX: P*0.95, rHipX: P*0.95,
        lKnX: -P*0.05, rKnX: -P*0.05,
        spineX: -P*0.10,
        rootRotX: -P*0.10, ...pend(-P*0.10) } },
    // Extension – kroppen skjuter upp (höfter öppnas, kropp över stången)
    { t: 1.05, pose: { ...HANG_STRAIGHT,
        lHipX: P*0.15, rHipX: P*0.15,
        rootRotX: -P*0.25, ...pend(-P*0.25) } },
    // Kroppen roterar över stången till stödet
    { t: 1.25, pose: { ...HANG_STRAIGHT,
        rootRotX: -P*0.50, ...pend(-P*0.50) } },
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

  // Ojämna barr – pendel vid övre barren (Z = -0.70 i utrustningens lokal-rymd)
  "uneven-bars:swing": { kfs: (() => {
    const a = P * 0.28;
    const barZ = -0.70; // övre barren i unevenBars: Z = -barSep/2
    const fwd: Pose = { ...HANG_STRAIGHT, rootRotX:  a, lHipX:  P*0.10, rHipX:  P*0.10,
        rootZ: -HANG_DIST * Math.sin(a) + barZ,
        rootY:  HANG_DIST * (1 - Math.cos(a)) };
    const bak: Pose = { ...HANG_STRAIGHT, rootRotX: -a, lHipX: -P*0.07, rHipX: -P*0.07,
        rootZ: -HANG_DIST * Math.sin(-a) + barZ,
        rootY:  HANG_DIST * (1 - Math.cos(-a)) };
    return [
      { t: 0.0, pose: fwd },
      { t: 0.9, pose: bak },
      { t: 1.8, pose: fwd },
    ];
  })() },

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

  // Kullerbytta – hukande → huvud ner → rullning → resning
  "floor:forward-roll": { kfs: [
    { t: 0,    pose: { ...ZERO, ...ARMS_SIDE } },
    // Huk förbered
    { t: 0.25, pose: { ...ZERO,
        lHipX: P*0.65, rHipX: P*0.65, lKnX: -P*0.75, rKnX: -P*0.75,
        spineX: -P*0.20, rootY: -0.25,
        lShX: -P*0.70, rShX: -P*0.70, lElX: P*0.10, rElX: P*0.10 } },
    // Huvud mot mattan, händer i golvet
    { t: 0.55, pose: { ...ZERO,
        lHipX: P*0.85, rHipX: P*0.85, lKnX: -P*0.85, rKnX: -P*0.85,
        spineX: -P*0.60, headX: P*0.45,
        rootY: -0.55, rootZ: -0.20,
        lShX: -P*0.80, rShX: -P*0.80, lElX: P*0.05, rElX: P*0.05 } },
    // Full rullning – gymnasten upp och ner (rootRotX = π)
    { t: 0.90, pose: { ...ZERO,
        lHipX: P*0.90, rHipX: P*0.90, lKnX: -P*0.95, rKnX: -P*0.95,
        spineX: -P*0.30,
        rootRotX: P, rootY: -0.70, rootZ: -0.40,
        lShX: -P*0.15, rShX: -P*0.15, lElX: P*0.55, rElX: P*0.55 } },
    // Landning hukande, ansiktet framåt igen
    { t: 1.25, pose: { ...ZERO,
        lHipX: P*0.60, rHipX: P*0.60, lKnX: -P*0.70, rKnX: -P*0.70,
        spineX: -P*0.20, rootY: -0.25, rootZ: -0.60,
        lShX: -P*0.45, rShX: -P*0.45, lElX: P*0.15, rElX: P*0.15 } },
    // Res upp
    { t: 1.55, pose: { ...ZERO, ...ARMS_SIDE, rootZ: -0.65 } },
    { t: 1.80, pose: { ...ZERO, ...ARMS_SIDE, rootZ: -0.65 } },
  ] },

  // Hjulning – pga saknad root-roll approximerar vi via spineZ-vridning,
  // rootY-båge och kraftig rootRotY-vändning i mitten (gymnasten vänder
  // ryggen mot kameran på toppen).
  "floor:cartwheel": { kfs: [
    { t: 0,    pose: { ...ZERO, lShX: -P*0.9, rShX: -P*0.9, lShZ: -P*0.15, rShZ: P*0.15 } },
    // Framåtlutning mot sida
    { t: 0.30, pose: { ...ZERO,
        spineX: -P*0.30, spineZ: P*0.35,
        lShX: -P*0.95, rShX: -P*0.20,
        lShZ: -P*0.25, rShZ: P*0.50,
        lHipX: -P*0.10, rHipX: P*0.40, rKnX: -P*0.10,
        rootX: 0.20, rootY: -0.05 } },
    // Handstand i sidled (rot kring Y → gymnasten vänd 90°)
    { t: 0.60, pose: { ...ZERO,
        lShX: -P, rShX: -P, spineZ: P*0.10,
        lHipX: -P*0.05, rHipX: -P*0.05,
        lShZ: -P*0.05, rShZ: P*0.05,
        rootRotX: P, rootRotY: P*0.5,
        rootX: 0.45, rootY: 0.12 } },
    // Fortsatt rotation (gymnasten 180°)
    { t: 0.90, pose: { ...ZERO,
        lShX: -P, rShX: -P,
        spineZ: -P*0.10,
        rootRotX: P, rootRotY: P,
        rootX: 0.70, rootY: 0.10 } },
    // Fot ner på andra sidan
    { t: 1.20, pose: { ...ZERO,
        spineX: -P*0.25, spineZ: -P*0.35,
        lShX: -P*0.20, rShX: -P*0.95,
        lShZ: -P*0.50, rShZ: P*0.25,
        lHipX: P*0.40, rHipX: -P*0.10, lKnX: -P*0.10,
        rootRotY: P*1.5,
        rootX: 0.95, rootY: -0.05 } },
    // Res upp, armar upp, landning
    { t: 1.50, pose: { ...ZERO,
        lShX: -P*0.9, rShX: -P*0.9, lShZ: -P*0.15, rShZ: P*0.15,
        rootRotY: P*2,
        rootX: 1.15 } },
    { t: 1.80, pose: { ...ZERO,
        lShZ: -P*0.28, rShZ: P*0.28, lElX: P*0.05, rElX: P*0.05,
        rootRotY: P*2,
        rootX: 1.15 } },
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
    const p = evalKF(kfs, raw);

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
