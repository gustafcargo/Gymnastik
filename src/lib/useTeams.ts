import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase, sbError } from "./supabase";

export type Team = {
  id: string;
  club_id: string;
  name: string;
  created_at: string;
};

export type TeamMember = {
  user_id: string;
  role: "admin" | "coach" | "member";
  display_name: string;
};

export function useTeams(clubId: string | null) {
  const { user, loading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user || !clubId) {
      setTeams([]);
      return;
    }
    setFetching(true);
    setError(null);
    const { data, error: err } = await c
      .from("teams")
      .select("id, club_id, name, created_at")
      .eq("club_id", clubId)
      .order("name");
    setFetching(false);
    if (err) {
      setError(err.message);
      return;
    }
    setTeams((data ?? []) as Team[]);
  }, [user, clubId]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const createTeam = useCallback(async (name: string) => {
    const c = supabase();
    if (!c || !clubId) throw new Error("Ingen klubb vald");
    const { data, error: err } = await c
      .from("teams")
      .insert({ club_id: clubId, name: name.trim() })
      .select("id")
      .single();
    if (err) throw sbError(err, "Kunde inte skapa lag.", "teams.createTeam");
    await refetch();
    return data.id as string;
  }, [clubId, refetch]);

  return { teams, fetching, error, refetch, createTeam };
}

export function useTeamMembers(teamId: string | null) {
  const { user, loading } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user || !teamId) {
      setMembers([]);
      return;
    }
    setFetching(true);
    setError(null);
    // Separata queries — PostgREST hittar ingen direkt FK mellan
    // team_members och profiles (båda pekar på auth.users).
    const memRes = await c
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId);
    if (memRes.error) {
      setFetching(false);
      setError(memRes.error.message);
      return;
    }
    const memRows = (memRes.data ?? []) as { user_id: string; role: "admin" | "coach" | "member" }[];
    const userIds = memRows.map((r) => r.user_id);
    const profRes = userIds.length
      ? await c.from("profiles").select("user_id, display_name").in("user_id", userIds)
      : { data: [], error: null as null | { message: string } };
    setFetching(false);
    if (profRes.error) {
      setError(profRes.error.message);
      return;
    }
    const nameByUser = new Map<string, string>(
      (profRes.data ?? []).map((p) => [p.user_id as string, (p.display_name as string) ?? "Gymnast"]),
    );
    setMembers(memRows.map((r) => ({
      user_id: r.user_id,
      role: r.role,
      display_name: nameByUser.get(r.user_id) ?? "Gymnast",
    })));
  }, [user, teamId]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  return { members, fetching, error, refetch };
}
