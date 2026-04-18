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
  miss: 0,
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

type ScoreState = {
  score: number;
  combo: number;
  pendingTrick: PendingTrick | null;
  activeHold: ActiveHold | null;
  lastEvent: LastEvent | null;
  sessionBest: number;
  /** Bästa runda i Tävling-läget genom tiderna. Persistas. */
  lifetimeBestTavling: number;

  // Actions
  setPendingTrick: (t: PendingTrick | null) => void;
  setActiveHold: (h: ActiveHold | null) => void;
  recordTrick: (grade: TrickGrade, label: string, difficulty: number) => void;
  addHoldPoints: (deltaPts: number, label: string) => void;
  resetCombo: () => void;
  resetScore: () => void;
  commitSessionBest: () => void;
  commitLifetimeBest: () => void;
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

      setPendingTrick: (pendingTrick) => set({ pendingTrick }),
      setActiveHold: (activeHold) => set({ activeHold }),

      recordTrick: (grade, label, difficulty) => {
        if (scoreLocked()) return;
        const s = get();
        const isHit = grade !== "miss";
        const newCombo = isHit ? s.combo + 1 : 0;
        const mult = comboMultiplier(newCombo);
        const base = GRADE_POINTS[grade] * difficulty;
        const points = Math.round(base * mult);
        const newScore = s.score + points;
        set({
          score: newScore,
          combo: newCombo,
          sessionBest: Math.max(s.sessionBest, newScore),
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
        set({
          score: newScore,
          sessionBest: Math.max(s.sessionBest, newScore),
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
        }),

      commitSessionBest: () => {
        const s = get();
        set({ sessionBest: Math.max(s.sessionBest, s.score) });
      },

      commitLifetimeBest: () => {
        const s = get();
        set({ lifetimeBestTavling: Math.max(s.lifetimeBestTavling, s.score) });
      },
    }),
    {
      name: "gymnast-game-score-v1",
      // Persistera enbart lifetime-best — score/combo är sessionsbundet.
      partialize: (state) => ({ lifetimeBestTavling: state.lifetimeBestTavling }),
    },
  ),
);
