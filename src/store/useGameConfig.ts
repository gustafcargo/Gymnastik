/**
 * useGameConfig – svårighetsgrad och liknande inställningar för spelläget.
 *
 * difficulty:
 *   "auto"     – övningar spelas automatiskt (barn-läge, oförändrat beteende).
 *   "manuell"  – när gymnasten är monterad driver spelaren själv övningen via
 *                joysticken (framåt/bakåt skrubbar tidslinjen). Kräver lite
 *                mer skicklighet och är mer engagerande för äldre barn.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Difficulty = "auto" | "manuell";

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
        set((s) => ({ difficulty: s.difficulty === "auto" ? "manuell" : "auto" })),
    }),
    { name: "gymnast-game-config-v1" },
  ),
);
