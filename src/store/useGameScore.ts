/**
 * useGameScore – poäng, combo, per-försökstillstånd och fail/clear-mekanik
 * för Proffs-läget. Lifetimebest persistas men sessionscore inte.
 *
 * Modell (proffs-läge):
 *   • Varje redskap får två FÖRSÖK per spelomgång. Ett försök räknas så fort
 *     gymnasten antingen FAILAR (3 missar) eller KLARAR (10 hits).
 *   • När attempts[eqId] ≥ MAX_ATTEMPTS_PER_EQUIPMENT (2) låses redskapet för
 *     den egna spelaren resten av spelet.
 *   • När alla spelbara redskap har låsts → spelet är över (EndGameSummary).
 *   • Om samma redskap klaras två gånger behåller spelaren bara den BÄSTA av
 *     de två försökens poäng ("högsta poängen är den man tar med sig").
 *
 * Designprinciper:
 * - actions är rena dispatchers — HUD subscribar och spelar ljud reaktivt.
 * - pendingTrick/activeHoldZone exponeras som transient state så HUD-komponenten
 *   kan rita timing-ringen / hold-mätaren utan att veta vilken övning som körs.
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

export type TrickGrade = "perfect" | "great" | "good" | "ok" | "miss";

export const GRADE_POINTS: Record<TrickGrade, number> = {
  perfect: 120,
  great: 80,
  good: 45,
  ok: 20,
  miss: -30,
};

export const GRADE_LABELS: Record<TrickGrade, string> = {
  perfect: "PERFEKT!",
  great: "BRA!",
  good: "OK",
  ok: "Sådär",
  miss: "MISS",
};

export const GRADE_COLORS: Record<TrickGrade, string> = {
  perfect: "#22c55e",
  great: "#3b82f6",
  good: "#eab308",
  ok: "#94a3b8",
  miss: "#ef4444",
};

/** Tröskel för FAIL på aktuellt försök. */
export const MAX_MISSES_PER_ATTEMPT = 3;

/** Antal lyckade trick-grade (ej miss) som krävs för att KLARA ett försök. */
export const HITS_TO_CLEAR = 10;

/** Hur många "hits" ett fullbordat hold-fönster räknas som mot clear-tröskeln.
 *  Pure-hold-övningar har nu aktiva balance-tricks som driver scoringen, så
 *  completion ger bara 1 hit — en liten extra belöning för att man höll hela
 *  cykeln, inte ett fribiljett-clear. */
export const HOLD_COMPLETION_HITS = 1;

/** Max antal försök (fail + clear sammanlagt) per redskap per spelomgång. */
export const MAX_ATTEMPTS_PER_EQUIPMENT = 2;

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
  attempt: number;
  finalAttempt: boolean;
  at: number;
};

export type LastClear = {
  eqId: string;
  eqName: string;
  attemptScore: number;
  isBest: boolean;
  attempt: number;
  finalAttempt: boolean;
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
  /** Nettopoäng för AKTUELLT försök per redskap (nollställs efter clear/fail). */
  equipmentScore: Record<string, number>;
  /** Missar i AKTUELLT försök. Nollställs efter clear/fail. */
  equipmentMisses: Record<string, number>;
  /** Lyckade tricks i AKTUELLT försök. Nollställs efter clear/fail. */
  equipmentHits: Record<string, number>;
  /** Antal försök (fail+clear) som gjorts per redskap under spelomgången. */
  equipmentAttempts: Record<string, number>;
  /** Bästa clear-poäng per redskap (används när samma redskap klaras två ggr). */
  equipmentBestClear: Record<string, number>;
  /** Redskap som är låsta för spelaren (har använt upp sina försök). */
  failedEquipment: string[];
  /** Senaste fail för FAIL-toast. */
  lastFail: LastFail | null;
  /** Senaste clear för CLEAR-toast. */
  lastClear: LastClear | null;
  /** Signalflagga till GameGymnast3D: kliv ner från nämnt redskap. */
  pendingForceDismount: { eqId: string } | null;

  // Actions
  setPendingTrick: (t: PendingTrick | null) => void;
  setActiveHold: (h: ActiveHold | null) => void;
  recordTrick: (grade: TrickGrade, label: string, difficulty: number) => void;
  addHoldPoints: (deltaPts: number, label: string) => void;
  /** Kallas när spelaren har stått stilla igenom ett helt hold-fönster.
   *  Registreras som HOLD_COMPLETION_HITS hits mot clear-tröskeln + stor
   *  poäng-bonus ("great"-grad). Gör pure-hold-övningar möjliga att klara. */
  recordHoldCompletion: (label: string) => void;
  resetCombo: () => void;
  resetScore: () => void;
  commitSessionBest: () => void;
  commitLifetimeBest: () => void;
  commitLifetimeBestFri: () => void;

  // Per-redskap-actions
  beginMount: (eqId: string) => void;
  endMount: () => void;
  failCurrentEquipment: (eqName: string) => void;
  clearCurrentEquipment: (eqName: string) => void;
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
      equipmentHits: {},
      equipmentAttempts: {},
      equipmentBestClear: {},
      failedEquipment: [],
      lastFail: null,
      lastClear: null,
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
        const nextEqHits = { ...s.equipmentHits };
        if (eqId) {
          nextEqScore[eqId] = (nextEqScore[eqId] ?? 0) + points;
          if (!isHit) {
            nextEqMisses[eqId] = (nextEqMisses[eqId] ?? 0) + 1;
          } else {
            nextEqHits[eqId] = (nextEqHits[eqId] ?? 0) + 1;
          }
        }

        set({
          score: newScore,
          combo: newCombo,
          sessionBest: Math.max(s.sessionBest, newScore),
          equipmentScore: nextEqScore,
          equipmentMisses: nextEqMisses,
          equipmentHits: nextEqHits,
          lastEvent: {
            grade,
            label: `${GRADE_LABELS[grade]} ${label}`,
            points,
            multiplier: mult,
            at: Date.now(),
          },
        });
      },

      recordHoldCompletion: (label) => {
        if (scoreLocked()) return;
        const s = get();
        const newCombo = s.combo + 1;
        const mult = comboMultiplier(newCombo);
        const base = GRADE_POINTS.great; // 80 baspoäng per fullbordad hold
        const points = Math.round(base * mult);
        const newScore = s.score + points;
        const eqId = s.currentEqId;
        const nextEqScore = { ...s.equipmentScore };
        const nextEqHits = { ...s.equipmentHits };
        if (eqId) {
          nextEqScore[eqId] = (nextEqScore[eqId] ?? 0) + points;
          nextEqHits[eqId] = (nextEqHits[eqId] ?? 0) + HOLD_COMPLETION_HITS;
        }
        set({
          score: newScore,
          combo: newCombo,
          sessionBest: Math.max(s.sessionBest, newScore),
          equipmentScore: nextEqScore,
          equipmentHits: nextEqHits,
          lastEvent: {
            grade: "great",
            label: `H\u00e5ll klart: ${label}`,
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
          equipmentHits: {},
          equipmentAttempts: {},
          equipmentBestClear: {},
          failedEquipment: [],
          lastFail: null,
          lastClear: null,
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
        // Rulla tillbaka positiva nettopoäng från försöket (miss-straff behålls).
        const earned = s.equipmentScore[eqId] ?? 0;
        const rollback = Math.max(0, earned);
        const nextEqScore = { ...s.equipmentScore, [eqId]: 0 };
        const nextEqMisses = { ...s.equipmentMisses, [eqId]: 0 };
        const nextEqHits = { ...s.equipmentHits, [eqId]: 0 };
        const attempt = (s.equipmentAttempts[eqId] ?? 0) + 1;
        const nextAttempts = { ...s.equipmentAttempts, [eqId]: attempt };
        const isFinal = attempt >= MAX_ATTEMPTS_PER_EQUIPMENT;
        const newScore = Math.max(0, s.score - rollback);
        const nextFailed = isFinal && !s.failedEquipment.includes(eqId)
          ? [...s.failedEquipment, eqId]
          : s.failedEquipment;
        set({
          score: newScore,
          combo: 0,
          equipmentScore: nextEqScore,
          equipmentMisses: nextEqMisses,
          equipmentHits: nextEqHits,
          equipmentAttempts: nextAttempts,
          failedEquipment: nextFailed,
          lastFail: {
            eqId,
            eqName,
            rollbackPoints: rollback,
            attempt,
            finalAttempt: isFinal,
            at: Date.now(),
          },
          pendingForceDismount: { eqId },
        });
      },

      clearCurrentEquipment: (eqName) => {
        const s = get();
        const eqId = s.currentEqId;
        if (!eqId) return;
        const attemptScore = Math.max(0, s.equipmentScore[eqId] ?? 0);
        const prevBest = s.equipmentBestClear[eqId] ?? 0;
        const priorAttempts = s.equipmentAttempts[eqId] ?? 0;
        // Behåll bara det bästa försöket i totalen när redskapet klarats
        // flera gånger: totalpoängen innehåller redan båda försökens poäng,
        // så subtrahera det mindre.
        const scoreAdjust = priorAttempts > 0 ? -Math.min(prevBest, attemptScore) : 0;
        const newBest = Math.max(prevBest, attemptScore);
        const attempt = priorAttempts + 1;
        const isFinal = attempt >= MAX_ATTEMPTS_PER_EQUIPMENT;
        const nextEqScore = { ...s.equipmentScore, [eqId]: 0 };
        const nextEqMisses = { ...s.equipmentMisses, [eqId]: 0 };
        const nextEqHits = { ...s.equipmentHits, [eqId]: 0 };
        const nextAttempts = { ...s.equipmentAttempts, [eqId]: attempt };
        const nextBest = { ...s.equipmentBestClear, [eqId]: newBest };
        const nextFailed = isFinal && !s.failedEquipment.includes(eqId)
          ? [...s.failedEquipment, eqId]
          : s.failedEquipment;
        const newScore = Math.max(0, s.score + scoreAdjust);
        set({
          score: newScore,
          equipmentScore: nextEqScore,
          equipmentMisses: nextEqMisses,
          equipmentHits: nextEqHits,
          equipmentAttempts: nextAttempts,
          equipmentBestClear: nextBest,
          failedEquipment: nextFailed,
          lastClear: {
            eqId,
            eqName,
            attemptScore,
            isBest: attemptScore >= prevBest,
            attempt,
            finalAttempt: isFinal,
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
          equipmentHits: {},
          equipmentAttempts: {},
          equipmentBestClear: {},
          lastFail: null,
          lastClear: null,
          pendingForceDismount: null,
        });
      },

      consumePendingForceDismount: () => {
        set({ pendingForceDismount: null });
      },
    }),
    {
      name: "gymnast-game-score-v1",
      // Persistera bara lifetime-best — allt session-specifikt ska börja rent.
      partialize: (state) => ({
        lifetimeBestTavling: state.lifetimeBestTavling,
        lifetimeBestFri: state.lifetimeBestFri,
      }),
    },
  ),
);
