/**
 * useCapabilities(clubId) – effektiva förmågor för inloggad user i en
 * specifik klubb. Hämtar rollen via `club_members`, slår upp ev. override-
 * rad i `member_capabilities` och returnerar det sammanslagna CapabilitySet.
 *
 * Om user ej är med i klubben → NO_CAPABILITIES.
 * Om ej inloggad / Supabase ej konfigurerat → NO_CAPABILITIES (loading = false).
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import {
  NO_CAPABILITIES,
  resolveCapabilities,
  type Capability,
  type CapabilitySet,
  type MemberRole,
} from "./capabilities";

type CapState = {
  caps: CapabilitySet;
  role: MemberRole | null;
  loading: boolean;
  error: string | null;
};

export function useCapabilities(clubId: string | null) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<CapState>({
    caps: NO_CAPABILITIES,
    role: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user || !clubId) {
      setState({ caps: NO_CAPABILITIES, role: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    const [memberRes, capRes] = await Promise.all([
      c.from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle(),
      c.from("member_capabilities")
        .select("overrides")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (memberRes.error) {
      setState({ caps: NO_CAPABILITIES, role: null, loading: false, error: memberRes.error.message });
      return;
    }

    const role = (memberRes.data?.role as MemberRole | undefined) ?? null;
    if (!role) {
      setState({ caps: NO_CAPABILITIES, role: null, loading: false, error: null });
      return;
    }

    const overrides =
      (capRes.data?.overrides as Partial<Record<Capability, boolean>> | undefined) ?? null;
    setState({
      caps: resolveCapabilities(role, overrides),
      role,
      loading: false,
      error: capRes.error?.message ?? null,
    });
  }, [user, clubId]);

  useEffect(() => {
    if (authLoading) return;
    void refetch();
  }, [authLoading, refetch]);

  const can = useCallback(
    (cap: Capability) => state.caps[cap] === true,
    [state.caps],
  );

  return { ...state, can, refetch };
}
