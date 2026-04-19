/**
 * useInvites – CRUD för klubb/lag-inbjudningar via e-post.
 *
 * Tre hooks:
 *   • useOutgoingInvites(scope): alla inbjudningar jag skapat till en
 *     specifik klubb eller ett specifikt lag (admin/coach-vy).
 *   • useIncomingInvites(): alla inbjudningar adresserade till min e-post,
 *     ej förbrukade och ej utgångna.
 *   • createInvite(...): skapa en inbjudan.
 *   • acceptInvite(token): ropar RPC `accept_invite` och returnerar vart
 *     man blev medlem.
 *   • revokeInvite(id): radera en inbjudan man skapat.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase, sbError } from "./supabase";

export type MemberRole = "admin" | "coach" | "member";

export type InviteRow = {
  id: string;
  club_id: string | null;
  team_id: string | null;
  email: string;
  role: MemberRole;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

type Scope =
  | { kind: "club";  clubId: string }
  | { kind: "team";  teamId: string }
  | null;

export function useOutgoingInvites(scope: Scope) {
  const { user, loading } = useAuth();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user || !scope) { setInvites([]); return; }
    setFetching(true);
    setError(null);
    const q = c.from("invites").select("*").eq("created_by", user.id);
    const { data, error: err } = scope.kind === "club"
      ? await q.eq("club_id", scope.clubId)
      : await q.eq("team_id", scope.teamId);
    setFetching(false);
    if (err) { setError(err.message); return; }
    setInvites((data ?? []) as InviteRow[]);
  }, [user, scope]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const createInvite = useCallback(async (
    email: string,
    role: MemberRole,
  ) => {
    const c = supabase();
    if (!c || !user || !scope) throw new Error("Inte inloggad");
    const row: Partial<InviteRow> & { created_by: string; email: string; role: MemberRole } = {
      email: email.trim().toLowerCase(),
      role,
      created_by: user.id,
    };
    if (scope.kind === "club") row.club_id = scope.clubId;
    else row.team_id = scope.teamId;
    const { error: err } = await c.from("invites").insert(row);
    if (err) throw sbError(err, "Kunde inte skapa inbjudan.", "invites.create");
    await refetch();
  }, [user, scope, refetch]);

  const revokeInvite = useCallback(async (id: string) => {
    const c = supabase();
    if (!c || !user) throw new Error("Inte inloggad");
    const { error: err } = await c.from("invites").delete().eq("id", id);
    if (err) throw sbError(err, "Kunde inte ta bort inbjudan.", "invites.revoke");
    await refetch();
  }, [user, refetch]);

  return { invites, fetching, error, refetch, createInvite, revokeInvite };
}

export function useIncomingInvites() {
  const { user, loading } = useAuth();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user) { setInvites([]); return; }
    setFetching(true);
    setError(null);
    const { data, error: err } = await c
      .from("invites")
      .select("*")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .neq("created_by", user.id)
      .order("created_at", { ascending: false });
    setFetching(false);
    if (err) { setError(err.message); return; }
    setInvites((data ?? []) as InviteRow[]);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const acceptInvite = useCallback(async (token: string) => {
    const c = supabase();
    if (!c || !user) throw new Error("Inte inloggad");
    const { data, error: err } = await c.rpc("accept_invite", { p_token: token });
    if (err) throw sbError(err, "Kunde inte acceptera inbjudan.", "invites.accept");
    await refetch();
    const row = Array.isArray(data) ? data[0] : data;
    return row as { club_id: string | null; team_id: string | null; role: MemberRole } | null;
  }, [user, refetch]);

  return { invites, fetching, error, refetch, acceptInvite };
}
