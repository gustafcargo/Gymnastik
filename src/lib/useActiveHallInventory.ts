/**
 * useActiveHallInventory – om `plan.hall.id` är ett UUID (användar-skapad
 * hall i Supabase), slå upp redskaps-inventariet för den hallen och
 * returnera ett `Set<equipment_type_id>` som redskapspaletten kan
 * filtrera på. För de statiska mall-hallarna (liten/standard/…) finns
 * ingen koppling → returnera `null` = inget filter.
 */
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import { usePlanStore } from "../store/usePlanStore";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useActiveHallInventory(): Set<string> | null {
  const hallId = usePlanStore((s) => s.plan.hall.id);
  const { user, loading } = useAuth();
  const [allowed, setAllowed] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!UUID_RE.test(hallId)) {
      setAllowed(null);
      return;
    }
    const c = supabase();
    if (!c || !user) {
      setAllowed(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await c
        .from("equipment_inventory")
        .select("equipment_type_id, quantity")
        .eq("hall_id", hallId);
      if (cancelled) return;
      if (error) {
        // Tyst fallback — om läsning misslyckas låter vi paletten visa allt.
        console.warn("[useActiveHallInventory]", error.message);
        setAllowed(null);
        return;
      }
      const ids = (data ?? [])
        .filter((r) => (r.quantity as number) > 0)
        .map((r) => r.equipment_type_id as string);
      setAllowed(new Set(ids));
    })();
    return () => {
      cancelled = true;
    };
  }, [hallId, user, loading]);

  return allowed;
}
