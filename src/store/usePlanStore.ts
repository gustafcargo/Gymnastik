import { create } from "zustand";
import { temporal } from "zundo";
import { nanoid } from "nanoid";
import type {
  HallTemplate,
  PlacedEquipment,
  Plan,
  Station,
  ViewMode,
} from "../types";
import { DEFAULT_HALL } from "../catalog/halls";
import { EQUIPMENT_BY_ID } from "../catalog/equipment";
import { clampToHall } from "../lib/geometry";
import {
  getActivePlanId,
  getPlan,
  listPlans,
  savePlan,
  setActivePlanId,
  deletePlan as deletePlanStorage,
} from "../lib/storage";

type PlanState = {
  plan: Plan;
  selectedEquipmentId: string | null;
  snapToGrid: boolean;
  snapStepM: number;
  viewMode: ViewMode;
};

type PlanActions = {
  // plan-lifecycle
  newPlan: (name?: string) => void;
  loadPlan: (id: string) => void;
  listSavedPlans: () => Plan[];
  deleteSavedPlan: (id: string) => void;
  renamePlan: (name: string) => void;
  setHall: (hall: HallTemplate) => void;

  // equipment
  addEquipment: (typeId: string, xM: number, yM: number) => string | undefined;
  addEquipmentCenter: (typeId: string) => string | undefined;
  moveEquipment: (id: string, xM: number, yM: number) => void;
  transformEquipment: (
    id: string,
    next: Partial<
      Pick<PlacedEquipment, "x" | "y" | "rotation" | "scaleX" | "scaleY">
    >,
  ) => void;
  updateEquipment: (id: string, patch: Partial<PlacedEquipment>) => void;
  deleteEquipment: (id: string) => void;
  duplicateEquipment: (id: string) => string | undefined;
  rotateEquipment: (id: string, deltaDeg: number) => void;

  // selection & settings
  selectEquipment: (id: string | null) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;

  // stations
  addStation: (name?: string) => string;
  selectStation: (id: string) => void;
  renameStation: (id: string, name: string) => void;
  setStationDuration: (id: string, minutes: number) => void;
  deleteStation: (id: string) => void;
  duplicateStation: (id: string) => string | undefined;
  reorderStations: (fromIndex: number, toIndex: number) => void;
};

export type PlanStore = PlanState & PlanActions;

function createStation(name = "Station 1"): Station {
  return {
    id: nanoid(),
    name,
    durationMin: 15,
    equipment: [],
  };
}

function createPlan(name = "Nytt pass"): Plan {
  const station = createStation("Uppvärmning");
  return {
    id: nanoid(),
    name,
    hall: DEFAULT_HALL,
    stations: [station],
    activeStationId: station.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function initialPlan(): Plan {
  const activeId = getActivePlanId();
  if (activeId) {
    const saved = getPlan(activeId);
    if (saved) return saved;
  }
  const list = listPlans();
  if (list.length > 0) return list[0];
  return createPlan();
}

function withActiveStation(
  plan: Plan,
  mutator: (station: Station) => Station,
): Plan {
  return {
    ...plan,
    stations: plan.stations.map((s) =>
      s.id === plan.activeStationId ? mutator(s) : s,
    ),
    updatedAt: Date.now(),
  };
}

export const usePlanStore = create<PlanStore>()(
  temporal(
    (set, get) => ({
      plan: initialPlan(),
      selectedEquipmentId: null,
      snapToGrid: true,
      snapStepM: 0.25,
      viewMode: "2D" as ViewMode,

      newPlan: (name) =>
        set(() => {
          const plan = createPlan(name);
          setActivePlanId(plan.id);
          return { plan, selectedEquipmentId: null };
        }),

      loadPlan: (id) =>
        set(() => {
          const p = getPlan(id);
          if (!p) return {};
          setActivePlanId(p.id);
          return { plan: p, selectedEquipmentId: null };
        }),

      listSavedPlans: () => listPlans(),

      deleteSavedPlan: (id) =>
        set((state) => {
          deletePlanStorage(id);
          if (state.plan.id === id) {
            const next = createPlan();
            setActivePlanId(next.id);
            return { plan: next, selectedEquipmentId: null };
          }
          return {};
        }),

      renamePlan: (name) =>
        set((state) => ({
          plan: { ...state.plan, name, updatedAt: Date.now() },
        })),

      setHall: (hall) =>
        set((state) => ({
          plan: { ...state.plan, hall, updatedAt: Date.now() },
        })),

      addEquipment: (typeId, xM, yM) => {
        const type = EQUIPMENT_BY_ID[typeId];
        if (!type) return undefined;
        const state = get();
        const hall = state.plan.hall;
        const { x, y } = clampToHall(
          xM,
          yM,
          type.widthM,
          type.heightM,
          hall.widthM,
          hall.heightM,
        );
        const newEq: PlacedEquipment = {
          id: nanoid(),
          typeId,
          x,
          y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: [...st.equipment, newEq],
          })),
          selectedEquipmentId: newEq.id,
        }));
        return newEq.id;
      },

      addEquipmentCenter: (typeId) => {
        const state = get();
        return state.addEquipment(
          typeId,
          state.plan.hall.widthM / 2,
          state.plan.hall.heightM / 2,
        );
      },

      moveEquipment: (id, xM, yM) =>
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: st.equipment.map((eq) =>
              eq.id === id ? { ...eq, x: xM, y: yM } : eq,
            ),
          })),
        })),

      transformEquipment: (id, next) =>
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: st.equipment.map((eq) =>
              eq.id === id ? { ...eq, ...next } : eq,
            ),
          })),
        })),

      updateEquipment: (id, patch) =>
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: st.equipment.map((eq) =>
              eq.id === id ? { ...eq, ...patch } : eq,
            ),
          })),
        })),

      deleteEquipment: (id) =>
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: st.equipment.filter((eq) => eq.id !== id),
          })),
          selectedEquipmentId:
            s.selectedEquipmentId === id ? null : s.selectedEquipmentId,
        })),

      duplicateEquipment: (id) => {
        const state = get();
        const station = state.plan.stations.find(
          (s) => s.id === state.plan.activeStationId,
        );
        const eq = station?.equipment.find((e) => e.id === id);
        if (!eq) return undefined;
        const newId = nanoid();
        const newEq: PlacedEquipment = {
          ...eq,
          id: newId,
          x: eq.x + 0.5,
          y: eq.y + 0.5,
        };
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: [...st.equipment, newEq],
          })),
          selectedEquipmentId: newId,
        }));
        return newId;
      },

      rotateEquipment: (id, deltaDeg) =>
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: st.equipment.map((eq) =>
              eq.id === id
                ? { ...eq, rotation: (eq.rotation + deltaDeg) % 360 }
                : eq,
            ),
          })),
        })),

      selectEquipment: (id) => set({ selectedEquipmentId: id }),
      setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleViewMode: () =>
        set((s) => ({ viewMode: s.viewMode === "2D" ? "3D" : "2D" })),

      addStation: (name) => {
        const state = get();
        const nextIndex = state.plan.stations.length + 1;
        const station = createStation(name ?? `Station ${nextIndex}`);
        set((s) => ({
          plan: {
            ...s.plan,
            stations: [...s.plan.stations, station],
            activeStationId: station.id,
            updatedAt: Date.now(),
          },
          selectedEquipmentId: null,
        }));
        return station.id;
      },

      selectStation: (id) =>
        set((s) => {
          if (!s.plan.stations.some((st) => st.id === id)) return {};
          return {
            plan: { ...s.plan, activeStationId: id, updatedAt: Date.now() },
            selectedEquipmentId: null,
          };
        }),

      renameStation: (id, name) =>
        set((s) => ({
          plan: {
            ...s.plan,
            stations: s.plan.stations.map((st) =>
              st.id === id ? { ...st, name } : st,
            ),
            updatedAt: Date.now(),
          },
        })),

      setStationDuration: (id, minutes) =>
        set((s) => ({
          plan: {
            ...s.plan,
            stations: s.plan.stations.map((st) =>
              st.id === id ? { ...st, durationMin: Math.max(1, minutes) } : st,
            ),
            updatedAt: Date.now(),
          },
        })),

      deleteStation: (id) =>
        set((s) => {
          if (s.plan.stations.length <= 1) return {}; // behåll minst en
          const stations = s.plan.stations.filter((st) => st.id !== id);
          const activeStationId =
            s.plan.activeStationId === id
              ? stations[0].id
              : s.plan.activeStationId;
          return {
            plan: { ...s.plan, stations, activeStationId, updatedAt: Date.now() },
            selectedEquipmentId: null,
          };
        }),

      duplicateStation: (id) => {
        const state = get();
        const station = state.plan.stations.find((st) => st.id === id);
        if (!station) return undefined;
        const copy: Station = {
          ...station,
          id: nanoid(),
          name: `${station.name} (kopia)`,
          equipment: station.equipment.map((e) => ({ ...e, id: nanoid() })),
        };
        set((s) => ({
          plan: {
            ...s.plan,
            stations: [...s.plan.stations, copy],
            activeStationId: copy.id,
            updatedAt: Date.now(),
          },
          selectedEquipmentId: null,
        }));
        return copy.id;
      },

      reorderStations: (fromIndex, toIndex) =>
        set((s) => {
          const next = [...s.plan.stations];
          const [moved] = next.splice(fromIndex, 1);
          if (!moved) return {};
          next.splice(toIndex, 0, moved);
          return {
            plan: { ...s.plan, stations: next, updatedAt: Date.now() },
          };
        }),
    }),
    {
      // Exclude ephemeral fields from undo history.
      partialize: (state) => {
        const {
          selectedEquipmentId: _sel,
          snapToGrid: _s,
          snapStepM: _ss,
          viewMode: _vm,
          ...rest
        } = state;
        void _sel;
        void _s;
        void _ss;
        void _vm;
        return rest;
      },
      limit: 100,
    },
  ),
);

/**
 * Hämta temporal store för att koppla undo/redo-knappar.
 */
export const useTemporalStore = usePlanStore.temporal;

/**
 * Autospara till localStorage vid varje planändring (debounced).
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
usePlanStore.subscribe((state, prev) => {
  if (state.plan === prev.plan) return;
  setActivePlanId(state.plan.id);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savePlan(state.plan), 500);
});

/** Initial persist så att nya pass listas direkt. */
if (typeof window !== "undefined") {
  try {
    savePlan(usePlanStore.getState().plan);
    setActivePlanId(usePlanStore.getState().plan.id);
  } catch (err) {
    // LocalStorage kan vara blockerad (privat läge på iOS Safari t.ex.)
    // – inte ett kritiskt fel, appen fortsätter utan persist.
    // eslint-disable-next-line no-console
    console.warn("[store] kunde inte spara initialt pass:", err);
  }
}
