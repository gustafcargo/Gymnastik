/**
 * useProfileSync – synkar inloggad users profil mot Supabase.
 *
 * Vid första inloggning på en enhet (no-row-yet): befintlig local-storage-
 * data (namn, färg, buddy-code, gymnast-style) pushas upp som profilen —
 * dvs "local wins". På efterföljande enheter: DB-värdena hämtas och
 * skriver in i lokala stores så de syns likadant överallt.
 *
 * När användaren uppdaterar namn/färg/buddyCode/gymnastStyle skriver vi
 * transparent tillbaka till Supabase. Om användaren inte är inloggad är
 * hela hooken no-op: local-storage-flödet fungerar som idag.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import { useMultiplayerStore } from "../store/useMultiplayerStore";
import { useFriendsStore } from "../store/useFriendsStore";
import { useGymnastTuning, type GymnastTuning } from "../store/useGymnastTuning";

function extractTuning(s: unknown): GymnastTuning {
  const { update: _u, reset: _r, ...data } = s as GymnastTuning & {
    update?: unknown;
    reset?: unknown;
  };
  void _u; void _r;
  return data as GymnastTuning;
}

type ProfileRow = {
  user_id: string;
  display_name: string;
  color: string;
  buddy_code: string | null;
  gymnast_style: Record<string, unknown>;
};

export function useProfileSync() {
  const { user, loading } = useAuth();
  const lastSyncedUserId = useRef<string | null>(null);
  const pushedOnceRef = useRef(false);

  // ── 1. När user loggas in: pull från DB eller push local. ───────────────
  useEffect(() => {
    if (loading || !user) {
      lastSyncedUserId.current = null;
      pushedOnceRef.current = false;
      return;
    }
    if (lastSyncedUserId.current === user.id) return;
    const c = supabase();
    if (!c) return;

    let cancelled = false;
    lastSyncedUserId.current = user.id;

    (async () => {
      const { data, error } = await c
        .from("profiles")
        .select("user_id, display_name, color, buddy_code, gymnast_style")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn("[profile] kunde inte läsa profil:", error.message);
        return;
      }

      const mp = useMultiplayerStore.getState();
      const fr = useFriendsStore.getState();
      const gt = extractTuning(useGymnastTuning.getState());

      if (data) {
        // DB har en profil: skriv in i lokala stores.
        const p = data as ProfileRow;
        if (p.display_name && p.display_name !== mp.playerName) {
          mp.setPlayerName(p.display_name);
        }
        if (p.color && p.color !== mp.playerColor) {
          mp.setPlayerColor(p.color);
        }
        if (p.buddy_code && p.buddy_code !== fr.buddyCode) {
          useFriendsStore.setState({ buddyCode: p.buddy_code });
        }
        if (p.gymnast_style && Object.keys(p.gymnast_style).length > 0) {
          useGymnastTuning.setState(p.gymnast_style as Partial<GymnastTuning>);
        }
        pushedOnceRef.current = true;
      } else {
        // Ingen profil finns → pusha nuvarande local state som första profil.
        const { error: insertError } = await c.from("profiles").upsert({
          user_id: user.id,
          display_name: mp.playerName,
          color: mp.playerColor,
          buddy_code: fr.buddyCode,
          gymnast_style: gt as unknown as Record<string, unknown>,
        }, { onConflict: "user_id" });
        if (insertError) {
          console.warn("[profile] kunde inte skapa profil:", insertError.message);
        }
        pushedOnceRef.current = true;
      }
    })();

    return () => { cancelled = true; };
  }, [loading, user]);

  // ── 2. Skriv igenom ändringar: subscribe på lokala stores. ──────────────
  //
  // Bara aktivt när user är inloggad OCH vi redan gjort initial-pushen
  // (annars riskerar vi att skriva över DB med default-värden innan vi
  // läst den första raden).
  useEffect(() => {
    if (!user) return;
    const c = supabase();
    if (!c) return;

    const writeProfile = (patch: Partial<ProfileRow>) => {
      if (!pushedOnceRef.current) return;
      c.from("profiles")
        .update(patch)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) console.warn("[profile] update misslyckades:", error.message);
        });
    };

    const unsubMp = useMultiplayerStore.subscribe((s, prev) => {
      const patch: Partial<ProfileRow> = {};
      if (s.playerName !== prev.playerName) patch.display_name = s.playerName;
      if (s.playerColor !== prev.playerColor) patch.color = s.playerColor;
      if (Object.keys(patch).length > 0) writeProfile(patch);
    });

    const unsubFr = useFriendsStore.subscribe((s, prev) => {
      if (s.buddyCode !== prev.buddyCode) {
        writeProfile({ buddy_code: s.buddyCode });
      }
    });

    let lastGtJson = JSON.stringify(extractTuning(useGymnastTuning.getState()));
    const unsubGt = useGymnastTuning.subscribe((s) => {
      const data = extractTuning(s);
      const json = JSON.stringify(data);
      if (json === lastGtJson) return;
      lastGtJson = json;
      writeProfile({ gymnast_style: data as unknown as Record<string, unknown> });
    });

    return () => {
      unsubMp();
      unsubFr();
      unsubGt();
    };
  }, [user]);
}
