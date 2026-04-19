/**
 * useFriendsSync – synkar lokala `useFriendsStore.friends` mot tabellen
 * `public.friends` i Supabase.
 *
 * Flöde:
 *   1. När user loggar in: hämta alla rader i `friends` där user_id = mig,
 *      joina med `profiles` för att få buddy_code + display_name.
 *   2. Merge:
 *        - Befintliga lokala vänner (bara buddyCode) behålls; om vi hittar
 *          en matchande DB-rad sätts deras `userId`.
 *        - DB-vänner som saknas lokalt läggs till.
 *   3. Subscribe: när lokal lista ändras:
 *        - Nya vänner utan `userId`: slå upp buddy_code i `profiles`, om
 *          den finns → insert i `friends` + skriv `userId` lokalt.
 *        - Borttagna vänner med `userId`: delete från DB.
 *
 * Hooken är no-op när Supabase inte är konfigurerat eller när user inte
 * är inloggad — local-storage-flödet fungerar som idag.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import { useFriendsStore, type Friend } from "../store/useFriendsStore";

type FriendRow = {
  friend_user_id: string;
  created_at: string;
};

type ProfileLite = {
  user_id: string;
  buddy_code: string | null;
  display_name: string | null;
};

export function useFriendsSync() {
  const { user, loading } = useAuth();
  const lastSyncedUserId = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  // ── 1. Hydrera lokala listan från DB vid inloggning ─────────────────────
  useEffect(() => {
    if (loading || !user) {
      lastSyncedUserId.current = null;
      hydratedRef.current = false;
      return;
    }
    if (lastSyncedUserId.current === user.id) return;
    const c = supabase();
    if (!c) return;

    let cancelled = false;
    lastSyncedUserId.current = user.id;

    (async () => {
      const { data, error } = await c
        .from("friends")
        .select("friend_user_id, created_at")
        .eq("user_id", user.id);

      if (cancelled) return;
      if (error) {
        console.warn("[friends] kunde inte läsa vänner:", error.message);
        return;
      }

      const rows = (data ?? []) as FriendRow[];
      const ids = rows.map((r) => r.friend_user_id);

      let profiles: ProfileLite[] = [];
      if (ids.length > 0) {
        const pr = await c
          .from("profiles")
          .select("user_id, buddy_code, display_name")
          .in("user_id", ids);
        if (pr.error) {
          console.warn("[friends] kunde inte läsa profiler:", pr.error.message);
        } else {
          profiles = (pr.data ?? []) as ProfileLite[];
        }
      }

      const profByUser = new Map(profiles.map((p) => [p.user_id, p]));
      const local = useFriendsStore.getState().friends;
      const byCode = new Map<string, Friend>();
      for (const f of local) byCode.set(f.buddyCode, f);

      for (const row of rows) {
        const prof = profByUser.get(row.friend_user_id);
        const code = prof?.buddy_code ?? null;
        if (!code) continue;
        const existing = byCode.get(code);
        const addedAt = Date.parse(row.created_at) || Date.now();
        const merged: Friend = existing
          ? { ...existing, userId: row.friend_user_id,
              savedName: existing.savedName ?? prof?.display_name ?? undefined }
          : { buddyCode: code, userId: row.friend_user_id,
              savedName: prof?.display_name ?? undefined, addedAt };
        byCode.set(code, merged);
      }

      useFriendsStore.setState({ friends: Array.from(byCode.values()) });
      hydratedRef.current = true;
    })();

    return () => { cancelled = true; };
  }, [loading, user]);

  // ── 2. Skriv-igenom: bevaka lokala ändringar ────────────────────────────
  useEffect(() => {
    if (!user) return;
    const c = supabase();
    if (!c) return;

    const resolveCode = async (code: string) => {
      const { data, error } = await c
        .from("profiles")
        .select("user_id")
        .eq("buddy_code", code)
        .maybeSingle();
      if (error) {
        console.warn("[friends] profillookup misslyckades:", error.message);
        return null;
      }
      return (data?.user_id as string | undefined) ?? null;
    };

    const unsub = useFriendsStore.subscribe((s, prev) => {
      if (!hydratedRef.current) return;
      if (s.friends === prev.friends) return;

      const prevByCode = new Map(prev.friends.map((f) => [f.buddyCode, f]));
      const nextByCode = new Map(s.friends.map((f) => [f.buddyCode, f]));

      // Nya vänner (utan userId) → resolva + insert.
      for (const [code, f] of nextByCode) {
        if (prevByCode.has(code)) continue;
        if (f.userId) continue;
        if (code === s.buddyCode) continue;
        void (async () => {
          const friendUserId = await resolveCode(code);
          if (!friendUserId) return;
          if (friendUserId === user.id) return;
          const { error } = await c
            .from("friends")
            .upsert(
              { user_id: user.id, friend_user_id: friendUserId },
              { onConflict: "user_id,friend_user_id" },
            );
          if (error) {
            console.warn("[friends] insert misslyckades:", error.message);
            return;
          }
          // Skriv tillbaka userId lokalt.
          useFriendsStore.setState((state) => ({
            friends: state.friends.map((x) =>
              x.buddyCode === code ? { ...x, userId: friendUserId } : x,
            ),
          }));
        })();
      }

      // Borttagna vänner (med userId) → delete från DB.
      for (const [code, f] of prevByCode) {
        if (nextByCode.has(code)) continue;
        if (!f.userId) continue;
        void c
          .from("friends")
          .delete()
          .eq("user_id", user.id)
          .eq("friend_user_id", f.userId)
          .then(({ error }) => {
            if (error) console.warn("[friends] delete misslyckades:", error.message);
          });
      }
    });

    return () => unsub();
  }, [user]);
}
