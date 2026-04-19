import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useRecentAccounts } from "../store/useRecentAccounts";

type AuthState = {
  /** true när vi fortfarande väntar på första sessionen från Supabase. */
  loading: boolean;
  session: Session | null;
  user: User | null;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: isSupabaseConfigured,
    session: null,
    user: null,
  });

  useEffect(() => {
    const c = supabase();
    if (!c) {
      setState({ loading: false, session: null, user: null });
      return;
    }
    let cancelled = false;
    c.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setState({
        loading: false,
        session: data.session,
        user: data.session?.user ?? null,
      });
    });
    const { data: sub } = c.auth.onAuthStateChange((_event, session) => {
      setState({
        loading: false,
        session,
        user: session?.user ?? null,
      });
      const email = session?.user?.email;
      if (email) useRecentAccounts.getState().remember(email);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const c = supabase();
    if (!c) throw new Error("Supabase är inte konfigurerat");
    const { error } = await c.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    useRecentAccounts.getState().remember(email);
  }, []);

  const signOut = useCallback(async () => {
    const c = supabase();
    if (!c) return;
    await c.auth.signOut();
  }, []);

  return {
    ...state,
    isSupabaseConfigured,
    signInWithEmail,
    signOut,
  };
}
