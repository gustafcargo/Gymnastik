/**
 * useRecentAccounts – kom-ihåg-lista med senast använda e-poster på denna
 * enhet. Gör det snabbt att byta mellan flera konton utan att skriva in
 * adressen igen.
 *
 * Lagrar bara e-poststrängar + tidsstämpel — ingen session, ingen token.
 * När man "fortsätter som" skickas en magic-link på nytt.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RecentAccount = {
  email: string;
  lastUsedAt: number;
};

type State = {
  accounts: RecentAccount[];
  remember: (email: string) => void;
  forget: (email: string) => void;
};

const MAX = 5;

export const useRecentAccounts = create<State>()(
  persist(
    (set) => ({
      accounts: [],
      remember: (email) => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) return;
        set((s) => {
          const rest = s.accounts.filter((a) => a.email !== trimmed);
          return {
            accounts: [
              { email: trimmed, lastUsedAt: Date.now() },
              ...rest,
            ].slice(0, MAX),
          };
        });
      },
      forget: (email) => {
        const trimmed = email.trim().toLowerCase();
        set((s) => ({
          accounts: s.accounts.filter((a) => a.email !== trimmed),
        }));
      },
    }),
    { name: "gymnast-recent-accounts-v1" },
  ),
);
