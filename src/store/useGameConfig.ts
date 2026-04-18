/**
 * useGameConfig – svårighetsgrad och liknande inställningar för spelläget.
 *
 * difficulty:
 *   "auto"     – övningar spelas automatiskt (barn-läge, oförändrat beteende).
 *   "manuell"  – när gymnasten är monterad driver spelaren själv övningen via
 *                joysticken (framåt/bakåt skrubbar tidslinjen).
 *   "proffs"   – som manuell, men med trick-fönster, hold-zoner och poäng.
 *                Riktar sig mot äldre barn (~9–13 år) som vill tävla.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Difficulty = "auto" | "manuell" | "proffs";

const ORDER: Difficulty[] = ["auto", "manuell", "proffs"];

type GameConfigState = {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  toggleDifficulty: () => void;
};

export const useGameConfig = create<GameConfigState>()(
  persist(
    (set) => ({
      difficulty: "auto",
      setDifficulty: (difficulty) => set({ difficulty }),
      toggleDifficulty: () =>
        set((s) => {
          const i = ORDER.indexOf(s.difficulty);
          return { difficulty: ORDER[(i + 1) % ORDER.length] };
        }),
    }),
    {
      name: "gymnast-game-config-v1",
      version: 2,
      // Migrera okända värden (t.ex. från äldre tvåläges-version) till "auto"
      // så gamla cache-data inte fastnar med ett ogiltigt difficulty-värde.
      migrate: (state) => {
        const s = (state ?? {}) as { difficulty?: unknown };
        const d = s.difficulty;
        if (d !== "auto" && d !== "manuell" && d !== "proffs") {
          return { ...s, difficulty: "auto" } as GameConfigState;
        }
        return state as GameConfigState;
      },
    },
  ),
);

/** Sant om proffs-läget aktiverat (trick-fönster, scoring etc). */
export const isProffsMode = (d: Difficulty) => d === "proffs";

/** Sant om spelaren själv driver tidslinjen (manuell eller proffs). */
export const isPlayerScrubbing = (d: Difficulty) => d === "manuell" || d === "proffs";
