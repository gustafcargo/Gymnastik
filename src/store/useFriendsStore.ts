/**
 * useFriendsStore – lokal vänlista baserad på vän-koder.
 *
 * Varje enhet genererar en egen 4-siffrig vän-kod som användaren delar
 * verbalt (eller via chat) med sina vänner. Vännen skriver in koden i
 * "Lägg till vän" → koden sparas i `friends`. När den vännen är online
 * i lobbyn matchar vi buddyCode → visar som "online".
 *
 * Allt persisteras i localStorage; ingen server-sida behövs.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Friend = {
  buddyCode: string;  // 4-siffrig kod som vännen delade med oss
  savedName?: string; // lokalt alias (vi sparar senaste sedda name också)
  addedAt: number;
  /** Supabase user-id när vi lyckats resolva buddy-koden mot en profil.
   *  Används av useFriendsSync för att skriva relationen mot DB. */
  userId?: string;
};

type FriendsState = {
  /** Egen vän-kod. Genereras en gång vid första start och ändras ej. */
  buddyCode: string;
  friends: Friend[];
  /** Om false: vi är fortfarande i lobbyn men vår identitet broadcastas
   *  inte — vännerna ser oss som offline. */
  visibleInLobby: boolean;
  addFriend: (buddyCode: string, savedName?: string) => boolean;
  removeFriend: (buddyCode: string) => void;
  renameFriend: (buddyCode: string, savedName: string) => void;
  toggleVisibility: () => void;
  setVisible: (visible: boolean) => void;
};

function genBuddyCode(): string {
  // 4-siffrig kod utan ledande nolla (1000-9999). 9000 kombinationer är
  // mer än tillräckligt för bekantskapskrets; kollision skulle bara
  // betyda att två olika folk råkar ha samma lokala kod — när du försöker
  // lägga till en vän med kollisions-kod resolverar lobbyn till en specifik
  // playerId baserat på vem som är online *just nu*.
  return String(1000 + Math.floor(Math.random() * 9000));
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set, get) => ({
      buddyCode: genBuddyCode(),
      friends: [],
      visibleInLobby: true,

      addFriend: (buddyCode, savedName) => {
        const trimmed = buddyCode.trim();
        if (!/^\d{4}$/.test(trimmed)) return false;
        if (trimmed === get().buddyCode) return false; // egen kod
        if (get().friends.some((f) => f.buddyCode === trimmed)) return false;
        set((s) => ({
          friends: [
            ...s.friends,
            { buddyCode: trimmed, savedName, addedAt: Date.now() },
          ],
        }));
        return true;
      },

      removeFriend: (buddyCode) => {
        set((s) => ({
          friends: s.friends.filter((f) => f.buddyCode !== buddyCode),
        }));
      },

      renameFriend: (buddyCode, savedName) => {
        set((s) => ({
          friends: s.friends.map((f) =>
            f.buddyCode === buddyCode ? { ...f, savedName } : f,
          ),
        }));
      },

      toggleVisibility: () => set((s) => ({ visibleInLobby: !s.visibleInLobby })),
      setVisible: (visible) => set({ visibleInLobby: visible }),
    }),
    {
      name: "gymnast-friends-v1",
      // Behåll allt — inget runtime-state att undanta.
    },
  ),
);
