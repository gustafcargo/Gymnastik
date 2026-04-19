/** UI-state för Övningsstudion + gymnast-utseende-panelen (globala toggles). */
import { create } from "zustand";

type StudioStore = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  appearanceOpen: boolean;
  setAppearanceOpen: (open: boolean) => void;
};

export const useStudioStore = create<StudioStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  appearanceOpen: false,
  setAppearanceOpen: (appearanceOpen) => set({ appearanceOpen }),
}));
