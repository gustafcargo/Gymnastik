/**
 * useAccountStore – UI-state för AccountPanel.
 *
 * Håller:
 *   - om panelen är öppen (och vilken flik)
 *   - vilket klubb-id som är "aktivt" (styr Hall/Team-flikarna)
 *
 * activeClubId persisteras så användaren inte behöver välja klubb igen
 * efter reload. Resten är runtime-flags.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccountTab = "profile" | "clubs" | "teams" | "halls";

type AccountStore = {
  open: boolean;
  tab: AccountTab;
  activeClubId: string | null;
  openPanel: (tab?: AccountTab) => void;
  closePanel: () => void;
  setTab: (tab: AccountTab) => void;
  setActiveClubId: (id: string | null) => void;
};

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      open: false,
      tab: "profile",
      activeClubId: null,
      openPanel: (tab) => set((s) => ({ open: true, tab: tab ?? s.tab })),
      closePanel: () => set({ open: false }),
      setTab: (tab) => set({ tab }),
      setActiveClubId: (id) => set({ activeClubId: id }),
    }),
    {
      name: "gymnast-account-v1",
      partialize: (s) => ({ activeClubId: s.activeClubId, tab: s.tab }),
    },
  ),
);
