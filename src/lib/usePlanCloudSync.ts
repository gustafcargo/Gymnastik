/**
 * usePlanCloudSync – synkar usens pass mot Supabase.
 *
 * Vid login: hämtar lista över plans i molnet (egna + delade).
 * Vid savePlan(): pushar hela plan-jsonet som en "user-ägd" rad i
 * plans-tabellen (onConflict: id, uppdaterar namn/plan/updated_at).
 *
 * Molnsynk påverkar inte localStorage-flödet — det är fortfarande
 * källan till sanning i appen. Molnet är en persistent backup/delning.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import { usePlanStore } from "../store/usePlanStore";
import { isCommittedPlan } from "./storage";
import type { Plan } from "../types";

export type CloudPlanMeta = {
  id: string;
  name: string;
  owner_user_id: string | null;
  owner_team_id: string | null;
  owner_club_id: string | null;
  updated_at: string;
};

/** Lista användarens tillgängliga molnpass (egna + delade). */
export function useCloudPlans() {
  const { user, loading } = useAuth();
  const [plans, setPlans] = useState<CloudPlanMeta[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user) {
      setPlans([]);
      return;
    }
    const { data, error: err } = await c
      .from("plans")
      .select("id, name, owner_user_id, owner_team_id, owner_club_id, updated_at")
      .order("updated_at", { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setPlans((data ?? []) as CloudPlanMeta[]);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const loadPlan = useCallback(async (id: string): Promise<Plan | null> => {
    const c = supabase();
    if (!c) return null;
    const { data, error: err } = await c
      .from("plans")
      .select("plan")
      .eq("id", id)
      .maybeSingle();
    if (err || !data) {
      if (err) setError(err.message);
      return null;
    }
    return data.plan as Plan;
  }, []);

  const deletePlan = useCallback(async (id: string) => {
    const c = supabase();
    if (!c) return;
    const { error: err } = await c.from("plans").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    await refetch();
  }, [refetch]);

  return { plans, error, refetch, loadPlan, deletePlan };
}

/**
 * Push-on-save: när isDirty går från true → false (dvs användaren tryckt
 * Spara) skickar vi plan-blobben till molnet som user-ägd rad. Upsert på
 * id så samma pass uppdateras mellan enheter.
 */
export function usePlanCloudSync() {
  const { user } = useAuth();
  const lastPushRef = useRef<string>(""); // sist pushad JSON-hash

  useEffect(() => {
    if (!user) return;
    const c = supabase();
    if (!c) return;

    const pushPlan = async (plan: Plan) => {
      const planJson = JSON.stringify(plan);
      if (planJson === lastPushRef.current) return;
      lastPushRef.current = planJson;
      const { error } = await c
        .from("plans")
        .upsert(
          {
            id: plan.id,
            owner_user_id: user.id,
            name: plan.name,
            plan: plan as unknown as Record<string, unknown>,
            created_by: user.id,
          },
          { onConflict: "id" },
        );
      if (error) {
        console.warn("[plans] cloud-push misslyckades:", error.message);
      }
    };

    // Initial push så molnet har senaste versionen direkt vid login —
    // men bara om passet är committat (användaren har tryckt Spara). Icke-
    // committade autosave-drafts ska aldrig läcka upp till molnet.
    const current = usePlanStore.getState();
    if (current.plan && isCommittedPlan(current.plan.id)) {
      void pushPlan(current.plan);
    }

    // Subscribe: pusha när isDirty går true → false (Spara trycktes).
    const unsub = usePlanStore.subscribe((s, prev) => {
      if (prev.isDirty && !s.isDirty && s.plan) {
        void pushPlan(s.plan);
      }
      // Även när användaren byter till ett annat pass (plan.id byter)
      // och det redan är committat: pusha en gång så molnet har det.
      if (
        prev.plan?.id !== s.plan?.id &&
        !s.isDirty &&
        s.plan &&
        isCommittedPlan(s.plan.id)
      ) {
        void pushPlan(s.plan);
      }
    });

    return () => unsub();
  }, [user]);
}
