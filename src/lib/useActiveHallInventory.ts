/**
 * useActiveHallInventory – om `plan.hall.id` är ett UUID (användar-skapad
 * hall i Supabase), slå upp redskaps-inventariet för den hallen och
 * returnera en `Map<equipment_type_id, quantity>` som redskapspaletten kan
 * filtrera och räkna antal på. För de statiska mall-hallarna (liten/
 * standard/…) finns ingen koppling → returnera `null` = inget filter,
 * ingen antalsvisning.
 */
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";
import { usePlanStore } from "../store/usePlanStore";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useActiveHallInventory(): Map<string, number> | null {
  const hallId = usePlanStore((s) => s.plan.hall.id);
  const { user, loading } = useAuth();
  const [inventory, setInventory] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!UUID_RE.test(hallId)) {
      setInventory(null);
      return;
    }
    const c = supabase();
    if (!c || !user) {
      setInventory(null);
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
        setInventory(null);
        return;
      }
      const map = new Map<string, number>();
      for (const r of data ?? []) {
        const q = r.quantity as number;
        if (q > 0) map.set(r.equipment_type_id as string, q);
      }
      setInventory(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [hallId, user, loading]);

  return inventory;
}
