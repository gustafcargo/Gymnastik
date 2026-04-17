/**
 * useCustomExercisesStore – håller användar-skapade övningar OCH overrides
 * för built-in övningar. Samma zustand+persist-mönster som useGymnastTuning.
 *
 * Två separata fält:
 *   - `customExercises`: metadata (id/label/apparatus/speed) för HELT nya
 *     övningar som inte finns i ALL_EXERCISES.
 *   - `customDefs`:      keyframes + metadata per id. Kan vara egna id:n
 *                        ELLER built-in-id:n → överskrider built-in vid
 *                        runtime via `useExerciseDef(id)`.
 *
 * "Återställ till original" raderar `customDefs[id]` utan att röra
 * built-ins-konstanten i koden.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Exercise } from "../catalog/exercises";
import type { ExerciseDef } from "../types/pose";

type State = {
  customExercises: Exercise[];
  customDefs: Record<string, ExerciseDef>;
};

type Actions = {
  /** Skapa/uppdatera en helt ny övning (skriver till båda fälten). */
  upsert: (ex: Exercise, def: ExerciseDef) => void;
  /** Lagra override för ett built-in-id (skriver bara till customDefs). */
  overrideBuiltIn: (id: string, def: ExerciseDef) => void;
  /** Ta bort custom-override; built-in återgår till sin konstant. */
  revertToBuiltIn: (id: string) => void;
  /** Ta bort en helt custom-skapad övning. */
  remove: (id: string) => void;
  /** Töm allt. */
  reset: () => void;
};

const EMPTY: State = { customExercises: [], customDefs: {} };

export const useCustomExercisesStore = create<State & Actions>()(
  persist(
    (set) => ({
      ...EMPTY,
      upsert: (ex, def) =>
        set((s) => {
          const others = s.customExercises.filter((e) => e.id !== ex.id);
          return {
            customExercises: [...others, ex],
            customDefs: { ...s.customDefs, [ex.id]: def },
          };
        }),
      overrideBuiltIn: (id, def) =>
        set((s) => ({ customDefs: { ...s.customDefs, [id]: def } })),
      revertToBuiltIn: (id) =>
        set((s) => {
          const { [id]: _omit, ...rest } = s.customDefs;
          void _omit;
          return { customDefs: rest };
        }),
      remove: (id) =>
        set((s) => {
          const { [id]: _omit, ...rest } = s.customDefs;
          void _omit;
          return {
            customExercises: s.customExercises.filter((e) => e.id !== id),
            customDefs: rest,
          };
        }),
      reset: () => set({ ...EMPTY }),
    }),
    { name: "gymnast-custom-exercises-v1" },
  ),
);
