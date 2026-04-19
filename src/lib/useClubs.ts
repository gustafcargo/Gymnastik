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
    // Sanity: verifiera att klienten har en aktiv session innan vi försöker
    // insertet. Annars skickas requesten med bara anon-key och RLS-policyn
    // "clubs: any insert" (to authenticated) matchar inte → 42501 blir ett
    // kryptiskt "new row violates row-level security policy".
    const sess = await c.auth.getSession();
    if (!sess.data.session) {
      throw new Error(
        "Din inloggning verkar ha gått ut. Logga ut och in igen och försök på nytt.",
      );
    }
    const { data, error: err } = await c
      .from("clubs")
      .insert({ name: name.trim(), created_by: user.id })
      .select("id")
      .single();
    if (err) {
      throw sbError(
        err,
        "Kunde inte skapa förening. Kontrollera inloggningen och försök igen.",
        "clubs.createClub",
      );
    }
    await refetch();
    return data.id as string;
  }, [user, refetch]);

  return { clubs, fetching, error, refetch, createClub };
}
