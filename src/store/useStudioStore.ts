/** UI-state för Övningsstudion (global toggle). */
import { create } from "zustand";

type StudioStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const useStudioStore = create<StudioStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
