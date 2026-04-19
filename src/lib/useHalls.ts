import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "./supabase";

export type HallRow = {
  id: string;
  club_id: string;
  name: string;
  width_m: number;
  height_m: number;
};

export type InventoryRow = {
  id: string;
  hall_id: string;
  equipment_type_id: string;
  quantity: number;
  notes: string | null;
};

export function useHalls(clubId: string | null) {
  const { user, loading } = useAuth();
  const [halls, setHalls] = useState<HallRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user || !clubId) {
      setHalls([]);
      return;
    }
    const { data, error: err } = await c
      .from("halls")
      .select("id, club_id, name, width_m, height_m")
      .eq("club_id", clubId)
      .order("name");
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setHalls((data ?? []) as HallRow[]);
  }, [user, clubId]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const createHall = useCallback(
    async (name: string, widthM: number, heightM: number) => {
      const c = supabase();
      if (!c || !clubId) throw new Error("Ingen klubb vald");
      const { data, error: err } = await c
        .from("halls")
        .insert({
          club_id: clubId,
          name: name.trim(),
          width_m: widthM,
          height_m: heightM,
        })
        .select("id")
        .single();
      if (err) throw err;
      await refetch();
      return data.id as string;
    },
    [clubId, refetch],
  );

  return { halls, error, refetch, createHall };
}

export function useInventory(hallId: string | null) {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const c = supabase();
    if (!c || !user || !hallId) {
      setRows([]);
      return;
    }
    const { data, error: err } = await c
      .from("equipment_inventory")
      .select("id, hall_id, equipment_type_id, quantity, notes")
      .eq("hall_id", hallId);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setRows((data ?? []) as InventoryRow[]);
  }, [user, hallId]);

  useEffect(() => {
    if (loading) return;
    void refetch();
  }, [loading, refetch]);

  const upsertItem = useCallback(
    async (equipmentTypeId: string, quantity: number) => {
      const c = supabase();
      if (!c || !hallId) throw new Error("Ingen hall vald");
      if (quantity <= 0) {
        // Ta bort raden om kvantitet 0.
        const { error: err } = await c
          .from("equipment_inventory")
          .delete()
          .eq("hall_id", hallId)
          .eq("equipment_type_id", equipmentTypeId);
        if (err) throw err;
      } else {
        const { error: err } = await c
          .from("equipment_inventory")
          .upsert(
            { hall_id: hallId, equipment_type_id: equipmentTypeId, quantity },
            { onConflict: "hall_id,equipment_type_id" },
          );
        if (err) throw err;
      }
      await refetch();
    },
    [hallId, refetch],
  );

  const moveItem = useCallback(
    async (sourceId: string, targetHallId: string, quantity: number) => {
      const c = supabase();
      if (!c) throw new Error("Supabase saknas");
      const { error: err } = await c.rpc("move_inventory", {
        p_source_id: sourceId,
        p_target_hall: targetHallId,
        p_quantity: quantity,
      });
      if (err) throw err;
      await refetch();
    },
    [refetch],
  );

  return { rows, error, refetch, upsertItem, moveItem };
}
