/**
 * useClubMembers – lista alla medlemmar i en klubb med namn, roll och ev.
 * capability-overrides. Admin-hook används av CapabilitiesEditor för att
 * toggla per-medlem-förmågor.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import type { Capability, MemberRole } from "./capabilities";

export type ClubMember = {
  user_id: string;
  role: MemberRole;
  display_name: string;
  overrides: Partial<Record<Capability, boolean>>;
};

export function useClubMembers(clubId: string | null) {
  const { user, loading } = useAuth();
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user || !clubId) { setMembers([]); return; }
    setFetching(true);
    setError(null);
    const memRes = await c
      .from("club_members")
      .select("user_id, role, profiles!inner(display_name)")
      .eq("club_id", clubId);
    if (memRes.error) {
      setError(memRes.error.message);
      setFetching(false);
      return;
    }
    const capRes = await c
      .from("member_capabilities")
      .select("user_id, overrides")
      .eq("club_id", clubId);
    if (capRes.error) {
      // Läsning av caps ska inte blockera listan.
      console.warn("[caps] kunde inte läsa overrides:", capRes.error.message);
    }
    type MemRow = {
      user_id: string;
      role: MemberRole;
      profiles: { display_name: string };
    };
    const overridesByUser = new Map<string, Partial<Record<Capability, boolean>>>(
      (capRes.data ?? []).map((r) => [
        r.user_id as string,
        (r.overrides as Partial<Record<Capability, boolean>>) ?? {},
      ]),
    );
    const rows = (memRes.data ?? []) as unknown as MemRow[];
    setMembers(rows.map((r) => ({
      user_id: r.user_id,
      role: r.role,
      display_name: r.profiles.display_name,
      overrides: overridesByUser.get(r.user_id) ?? {},
    })));
    setFetching(false);
  }, [user, clubId]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const setRole = useCallback(async (userId: string, role: MemberRole) => {
    const c = supabase();
    if (!c || !clubId) throw new Error("Inte inloggad");
    const { error: err } = await c
      .from("club_members")
      .update({ role })
      .eq("club_id", clubId)
      .eq("user_id", userId);
    if (err) throw err;
    await refetch();
  }, [clubId, refetch]);

  const setOverrides = useCallback(async (
    userId: string,
    overrides: Partial<Record<Capability, boolean>>,
  ) => {
    const c = supabase();
    if (!c || !clubId) throw new Error("Inte inloggad");
    const { error: err } = await c
      .from("member_capabilities")
      .upsert(
        { club_id: clubId, user_id: userId, overrides },
        { onConflict: "club_id,user_id" },
      );
    if (err) throw err;
    await refetch();
  }, [clubId, refetch]);

  const removeMember = useCallback(async (userId: string) => {
    const c = supabase();
    if (!c || !clubId) throw new Error("Inte inloggad");
    const { error: err } = await c
      .from("club_members")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", userId);
    if (err) throw err;
    await refetch();
  }, [clubId, refetch]);

  return { members, fetching, error, refetch, setRole, setOverrides, removeMember };
}
