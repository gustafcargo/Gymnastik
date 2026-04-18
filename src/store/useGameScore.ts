/**
 * useGameScore – poäng, combo och pågående trick/hold-tillstånd för
 * Proffs-läget. Lifetimebest persistas (per gameMode) men sessionscore inte.
 *
 * Designprinciper:
 * - addPoints/recordTrick/recordHold är pure dispatch — ingen sidoeffekt
 *   på sound/HUD. HUD subscribar och spelar ljud reaktivt.
 * - pendingTrick/activeHoldZone exponeras som transient state så HUD-komponenten
 *   kan rita timing-ringen / hold-mätaren utan att veta vilken övning som körs.
 * - resetScore() ska köras när en runda startar (Tävling) eller när spelaren
 *   lämnar spelläget (så nästa session börjar rent).
 *
 * Per-redskap i proffs-läge:
 * - beginMount(eqId) anropas när gymnasten hoppar upp på ett redskap. Startar
 *   en "sub-konto" för eqId. endMount() stänger det (utan att radera historik).
 * - Varje recordTrick/addHoldPoints bokförs både mot totalpoäng OCH mot
 *   equipmentScore[currentEqId]. På MISS ökas equipmentMisses[currentEqId].
 *   Vid 2 missar → failCurrentEquipment(): alla poäng på redskapet rivs från
 *   total, redskapet markeras som failedEquipment, och en force-dismount-flagga
 *   sätts som GameGymnast3D läser för att kliva ner automatiskt.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrickType } from "../types/pose";
import { useGameMode } from "./useGameMode";

/** Sant om vi för tillfället INTE får dela ut poäng (tävlingsläget innan/utanför rund). */
function scoreLocked(): boolean {
  const m = useGameMode.getState();
  if (m.gameMode !== "tavling") return false;
  return m.roundState !== "running";
}

export type TrickGrade = "perfect" | "great" | "good" | "miss";

export const GRADE_POINTS: Record<TrickGrade, number> = {
  perfect: 100,
  great: 60,
  good: 30,
  miss: -30,
};

export const GRADE_LABELS: Record<TrickGrade, string> = {
  perfect: "PERFEKT!",
  great: "BRA!",
  good: "OK",
  miss: "MISS",
};

export const GRADE_COLORS: Record<TrickGrade, string> = {
  perfect: "#22c55e",
  great: "#3b82f6",
  good: "#eab308",
  miss: "#ef4444",
};

/** Max antal missar per redskap i proffs-läge innan FAIL triggas. */
export const MAX_MISSES_PER_EQUIPMENT = 2;

/** Combo-multiplikator: 1× upp till 2 i rad, sedan 1.5×, 2×, 3×, max 5×. */
export function comboMultiplier(combo: number): number {
  if (combo < 2) return 1;
  if (combo < 5) return 1.5;
  if (combo < 10) return 2;
  if (combo < 20) return 3;
  return 5;
}

export type PendingTrick = {
  exerciseId: string;
  eqId: string;
  type: TrickType;
  label: string;
  /** Sekunder kvar till perfekt timing (kan vara negativ inom toleransen). */
  dt: number;
  /** Toleransfönster i ms (±). */
  windowMs: number;
  /** Difficulty-multiplikator för base-poäng. */
  difficulty: number;
};

export type ActiveHold = {
  exerciseId: string;
  eqId: string;
  label: string;
  /** Sekunder spelaren har hållit stilla i zonen. */
  elapsedSec: number;
  /** Total längd på zonen i sekunder. */
  totalSec: number;
  /** Poäng per sekund (innan multiplikator). */
  pointsPerSec: number;
};

export type LastEvent = {
  grade?: TrickGrade;
  label: string;
  points: number;
  multiplier: number;
  /** wall-clock ms när händelsen registrerades (för att fade:a HUD). */
  at: number;
};

export type LastFail = {
  eqId: string;
  eqName: string;
  rollbackPoints: number;
  at: number;
};

type ScoreState = {
  score: number;
  combo: number;
  pendingTrick: PendingTrick | null;
  activeHold: ActiveHold | null;
  lastEvent: LastEvent | null;
  sessionBest: number;
  /** Bästa runda i Tävling-läget genom tiderna. Persistas. */
  lifetimeBestTavling: number;
  /** Bästa score i "Fri"-läget genom tiderna. Persistas separat. */
  lifetimeBestFri: number;

  /** Aktivt redskap — sätts av beginMount/endMount. null i fri rörelse. */
  currentEqId: string | null;
  /** Ackumulerad nettopoäng per redskap (inkl -30 för missar). */
  equipmentScore: Record<string, number>;
  /** Antal missar per redskap under innevarande game. */
  equipmentMisses: Record<string, number>;
  /** Redskap som spelaren misslyckats på under nuvarande game (endast lokalt). */
  failedEquipment: string[];
  /** Senaste fail för FAIL-toast. */
  lastFail: LastFail | null;
  /** Signalflagga till GameGymnast3D: kliv ner från nämnt redskap. */
  pendingForceDismount: { eqId: string } | null;

  // Actions
  setPendingTrick: (t: PendingTrick | null) => void;
  setActiveHold: (h: ActiveHold | null) => void;
  recordTrick: (grade: TrickGrade, label: string, difficulty: number) => void;
  addHoldPoints: (deltaPts: number, label: string) => void;
  resetCombo: () => void;
  resetScore: () => void;
  commitSessionBest: () => void;
  commitLifetimeBest: () => void;
  commitLifetimeBestFri: () => void;

  // Per-redskap-actions
  beginMount: (eqId: string) => void;
  endMount: () => void;
  failCurrentEquipment: (eqName: string) => void;
  clearFailedEquipment: () => void;
  consumePendingForceDismount: () => void;
};

export const useGameScore = create<ScoreState>()(
  persist(
    (set, get) => ({
      score: 0,
      combo: 0,
      pendingTrick: null,
      activeHold: null,
      lastEvent: null,
      sessionBest: 0,
      lifetimeBestTavling: 0,
      lifetimeBestFri: 0,

      currentEqId: null,
      equipmentScore: {},
      equipmentMisses: {},
      failedEquipment: [],
      lastFail: null,
      pendingForceDismount: null,

      setPendingTrick: (pendingTrick) => set({ pendingTrick }),
      setActiveHold: (activeHold) => set({ activeHold }),

      recordTrick: (grade, label, difficulty) => {
        if (scoreLocked()) return;
        const s = get();
        const isHit = grade !== "miss";
        const newCombo = isHit ? s.combo + 1 : 0;
        const mult = comboMultiplier(newCombo);
        const base = GRADE_POINTS[grade] * difficulty;
        // Miss-straff ska INTE multipliceras av combo (straff är konstant −30).
        const points = isHit ? Math.round(base * mult) : Math.round(base);
        const newScore = s.score + points;

        // Bokför mot aktuellt redskap (om monterad).
        const eqId = s.currentEqId;
        const nextEqScore = { ...s.equipmentScore };
        const nextEqMisses = { ...s.equipmentMisses };
        if (eqId) {
          nextEqScore[eqId] = (nextEqScore[eqId] ?? 0) + points;
          if (!isHit) {
            nextEqMisses[eqId] = (nextEqMisses[eqId] ?? 0) + 1;
          }
        }

        set({
          score: newScore,
          combo: newCombo,
          sessionBest: Math.max(s.sessionBest, newScore),
          equipmentScore: nextEqScore,
          equipmentMisses: nextEqMisses,
          lastEvent: {
            grade,
            label: `${GRADE_LABELS[grade]} ${label}`,
            points,
            multiplier: mult,
            at: Date.now(),
          },
        });
      },

      addHoldPoints: (deltaPts, label) => {
        if (scoreLocked()) return;
        const s = get();
        const mult = comboMultiplier(s.combo);
        const points = Math.round(deltaPts * mult);
        if (points <= 0) return;
        const newScore = s.score + points;

        const eqId = s.currentEqId;
        const nextEqScore = { ...s.equipmentScore };
        if (eqId) {
          nextEqScore[eqId] = (nextEqScore[eqId] ?? 0) + points;
        }

        set({
          score: newScore,
          sessionBest: Math.max(s.sessionBest, newScore),
          equipmentScore: nextEqScore,
          lastEvent: {
            label: `Håll: ${label}`,
            points,
            multiplier: mult,
            at: Date.now(),
          },
        });
      },

      resetCombo: () => set({ combo: 0 }),

      resetScore: () =>
        set({
          score: 0,
          combo: 0,
          pendingTrick: null,
          activeHold: null,
          lastEvent: null,
          currentEqId: null,
          equipmentScore: {},
          equipmentMisses: {},
          failedEquipment: [],
          lastFail: null,
          pendingForceDismount: null,
        }),

      commitSessionBest: () => {
        const s = get();
        set({ sessionBest: Math.max(s.sessionBest, s.score) });
      },

      commitLifetimeBest: () => {
        const s = get();
        set({ lifetimeBestTavling: Math.max(s.lifetimeBestTavling, s.score) });
      },

      commitLifetimeBestFri: () => {
        const s = get();
        set({ lifetimeBestFri: Math.max(s.lifetimeBestFri, s.score) });
      },

      beginMount: (eqId) => {
        set({ currentEqId: eqId });
      },

      endMount: () => {
        set({ currentEqId: null });
      },

      failCurrentEquipment: (eqName) => {
        const s = get();
        const eqId = s.currentEqId;
        if (!eqId) return;
        // Rulla tillbaka positiva nettopoäng från redskapet (förluster behålls).
        const earned = s.equipmentScore[eqId] ?? 0;
        const rollback = Math.max(0, earned);
        const nextEqScore = { ...s.equipmentScore };
        const nextEqMisses = { ...s.equipmentMisses };
        nextEqScore[eqId] = 0;
        nextEqMisses[eqId] = 0;
        const newScore = Math.max(0, s.score - rollback);
        const nextFailed = s.failedEquipment.includes(eqId)
          ? s.failedEquipment
          : [...s.failedEquipment, eqId];
        set({
          score: newScore,
          combo: 0,
          equipmentScore: nextEqScore,
          equipmentMisses: nextEqMisses,
          failedEquipment: nextFailed,
          lastFail: {
            eqId,
            eqName,
            rollbackPoints: rollback,
            at: Date.now(),
          },
          pendingForceDismount: { eqId },
        });
      },

      clearFailedEquipment: () => {
        set({
          failedEquipment: [],
          equipmentScore: {},
          equipmentMisses: {},
          lastFail: null,
          pendingForceDismount: null,
        });
      },

      consumePendingForceDismount: () => {
        set({ pendingForceDismount: null });
      },
    }),
    {
      name: "gymnast-game-score-v1",
      // Persistera bara lifetime-best — allt session-specifikt (score, combo,
      // failade redskap) ska börja rent varje gång.
      partialize: (state) => ({
        lifetimeBestTavling: state.lifetimeBestTavling,
        lifetimeBestFri: state.lifetimeBestFri,
      }),
    },
  ),
);
