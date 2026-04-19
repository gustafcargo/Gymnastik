/**
 * useClubs – hämtar alla klubbar den inloggade usern är med i,
 * inklusive dennes roll i varje klubb. Re-fetchar när user ändras.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase, sbError } from "./supabase";

export type ClubWithRole = {
  id: string;
  name: string;
  role: "admin" | "coach" | "member";
  created_at: string;
};

export function useClubs() {
  const { user, loading } = useAuth();
  const [clubs, setClubs] = useState<ClubWithRole[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user) {
      setClubs([]);
      return;
    }
    setFetching(true);
    setError(null);
    const { data, error: err } = await c
      .from("club_members")
      .select("role, joined_at, clubs!inner(id, name, created_at)")
      .eq("user_id", user.id);
    setFetching(false);
    if (err) {
      setError(err.message);
      return;
    }
    type Row = {
      role: "admin" | "coach" | "member";
      clubs: { id: string; name: string; created_at: string };
    };
    const rows = (data ?? []) as unknown as Row[];
    setClubs(rows.map((r) => ({
      id: r.clubs.id,
      name: r.clubs.name,
      role: r.role,
      created_at: r.clubs.created_at,
    })));
  }, [user]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const createClub = useCallback(async (name: string) => {
    const c = supabase();
    if (!c || !user) throw new Error("Inte inloggad");
    const sess = await c.auth.getSession();
    if (!sess.data.session) {
      throw new Error(
        "Din inloggning verkar ha gått ut. Logga ut och in igen och försök på nytt.",
      );
    }
    // Generera id:t klient-side och skippa .select() efter insert. Annars
    // blir det INSERT ... RETURNING, vars RETURNING kör SELECT-RLS
    // (is_club_member). Helpern är STABLE → cacheat svar innan AFTER-INSERT-
    // triggern gjort oss till admin → PostgREST läser 0 rader och svarar
    // "new row violates row-level security policy" trots att insertet gick.
    const newId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined;
    const row: { id?: string; name: string; created_by: string } = {
      name: name.trim(),
      created_by: user.id,
    };
    if (newId) row.id = newId;
    const { error: err } = await c.from("clubs").insert(row);
    if (err) {
      throw sbError(
        err,
        "Kunde inte skapa förening.",
        "clubs.createClub",
      );
    }
    await refetch();
    return newId ?? "";
  }, [user, refetch]);

  return { clubs, fetching, error, refetch, createClub };
}
