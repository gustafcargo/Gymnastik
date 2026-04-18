/**
 * useGameMode – spelläges-tillstånd för "Tävling" (round-based).
 *
 * Två lägen ("gameMode"):
 *   "fri"     – fortlöpande poängsamling, ingen timer (default).
 *   "tavling" – 60-sekunders rundor med countdown och slutscore-overlay.
 *
 * Rundor styrs av ett wall-clock-baserat schema (`roundEndsAt = Date.now() + dur*1000`),
 * vilket gör tillståndet broadcast-vänligt: alla klienter med samma `roundEndsAt`
 * är överens om när rundan slutar utan att synka tickar.
 *
 * Inget persistas — gameMode återgår till "fri" vid varje session, så Tävling
 * måste väljas medvetet.
 */
import { create } from "zustand";

export type GameMode = "fri" | "tavling";
export type RoundState = "idle" | "countdown" | "running" | "ended";

export const COUNTDOWN_SEC = 3;
export const DEFAULT_ROUND_SEC = 60;

export type Scorecard = {
  finalScore: number;
  bestCombo: number;
  beatLifetimeBest: boolean;
  prevLifetimeBest: number;
  endedAt: number;
};

type GameModeState = {
  gameMode: GameMode;
  roundDurationSec: number;
  roundState: RoundState;
  countdownStartedAt: number | null;
  roundStartedAt: number | null;
  roundEndsAt: number | null;
  lastScorecard: Scorecard | null;

  setGameMode: (m: GameMode) => void;
  toggleGameMode: () => void;
  startCountdown: () => void;
  beginRunning: () => void;
  endRound: (card: Scorecard) => void;
  resetRound: () => void;
  /** Tick som anropas varje frame; ändrar tillstånd när Date.now() passerar gränser. */
  computeStateFromClock: () => RoundState;
  /** Sekunder kvar till perfekt timing (negativ = passerat). */
  countdownSecondsLeft: () => number;
  roundSecondsLeft: () => number;
};

export const useGameMode = create<GameModeState>((set, get) => ({
  gameMode: "fri",
  roundDurationSec: DEFAULT_ROUND_SEC,
  roundState: "idle",
  countdownStartedAt: null,
  roundStartedAt: null,
  roundEndsAt: null,
  lastScorecard: null,

  setGameMode: (gameMode) => set({ gameMode }),
  toggleGameMode: () =>
    set((s) => ({ gameMode: s.gameMode === "fri" ? "tavling" : "fri" })),

  startCountdown: () =>
    set({
      roundState: "countdown",
      countdownStartedAt: Date.now(),
      roundStartedAt: null,
      roundEndsAt: null,
      lastScorecard: null,
    }),

  beginRunning: () => {
    const dur = get().roundDurationSec;
    const now = Date.now();
    set({
      roundState: "running",
      roundStartedAt: now,
      roundEndsAt: now + dur * 1000,
    });
  },

  endRound: (lastScorecard) =>
    set({
      roundState: "ended",
      lastScorecard,
    }),

  resetRound: () =>
    set({
      roundState: "idle",
      countdownStartedAt: null,
      roundStartedAt: null,
      roundEndsAt: null,
    }),

  computeStateFromClock: () => {
    const s = get();
    const now = Date.now();
    if (s.roundState === "countdown" && s.countdownStartedAt != null) {
      if (now >= s.countdownStartedAt + COUNTDOWN_SEC * 1000) {
        // Övergå till running. set sker via beginRunning för att hålla derivat-fält i sync.
        s.beginRunning();
        return "running";
      }
    }
    if (s.roundState === "running" && s.roundEndsAt != null && now >= s.roundEndsAt) {
      // Lämna kvar i "running" — ScoreOverlay sköter end-call med korrekt scorecard.
      return "running";
    }
    return s.roundState;
  },

  countdownSecondsLeft: () => {
    const s = get();
    if (s.countdownStartedAt == null) return 0;
    const elapsed = (Date.now() - s.countdownStartedAt) / 1000;
    return Math.max(0, COUNTDOWN_SEC - elapsed);
  },

  roundSecondsLeft: () => {
    const s = get();
    if (s.roundEndsAt == null) return 0;
    return Math.max(0, (s.roundEndsAt - Date.now()) / 1000);
  },
}));
