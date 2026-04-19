import { create } from "zustand";
import { temporal } from "zundo";
import { nanoid } from "nanoid";
import type {
  EquipmentType,
  GymnastConfig,
  HallTemplate,
  PlacedEquipment,
  Plan,
  Station,
  ViewMode,
} from "../types";
import { DEFAULT_HALL } from "../catalog/halls";
import { getEquipmentById } from "../catalog/equipment";
import { clampToHall } from "../lib/geometry";

// ---------------------------------------------------------------------------
// Mat auto-stacking
// ---------------------------------------------------------------------------

/** Kinds that auto-adjust their Z when placed on top of another surface. */
const MAT_KINDS = new Set([
  "thick-mat", "landing-mat",
  "tumbling-track", "air-track",
  "gym-bench", "plinth",
]);

/**
 * Kinds that act as stackable surfaces — other mats can land on top of them.
 * Includes mats themselves (for stacking multiple layers) plus flat tracks/floor.
 */
const STACKABLE_SURFACE_KINDS = new Set([
  "thick-mat", "landing-mat",
  "tumbling-track", "air-track", "floor",
  "gym-bench", "plinth",
]);

/** Return the physical top surface height for any stackable piece. */
function surfaceHeight(eq: PlacedEquipment, eqType: EquipmentType): number {
  const kind = eqType.detail?.kind ?? "";
  // For bench/plinth tilted on their side the rotated dimension becomes the height.
  if (kind === "gym-bench" || kind === "plinth") {
    if (eq.orientation === "on-long-side")  return (eq.z ?? 0) + eqType.widthM  * eq.scaleX;
    if (eq.orientation === "on-short-side") return (eq.z ?? 0) + eqType.heightM * eq.scaleY;
  }
  if (kind === "tumbling-track" || kind === "air-track") {
    return (eq.z ?? 0) + (eq.params?.trackH ?? eqType.physicalHeightM);
  }
  if (kind === "thick-mat" || kind === "landing-mat") {
    return (eq.z ?? 0) + (eq.params?.matH ?? eqType.physicalHeightM);
  }
  // floor, bench, plinth and any other surface: use physicalHeightM
  return (eq.z ?? 0) + eqType.physicalHeightM;
}

/**
 * Find the highest stackable surface under (x,y) and return it together with
 * its EquipmentType.  Returns null when nothing is underneath.
 */
function findTopSurface(
  station: Station,
  excludeId: string,
  x: number,
  y: number,
  type: EquipmentType,
): { eq: PlacedEquipment; eqType: EquipmentType } | null {
  let maxTop = 0;
  let result: { eq: PlacedEquipment; eqType: EquipmentType } | null = null;
  for (const eq of station.equipment) {
    if (eq.id === excludeId) continue;
    const eqType = getEquipmentById(eq.typeId);
    if (!eqType || !STACKABLE_SURFACE_KINDS.has(eqType.detail?.kind ?? "")) continue;
    const threshW = (type.widthM + eqType.widthM) * 0.5;
    const threshD = (type.heightM + eqType.heightM) * 0.5;
    if (Math.abs(eq.x - x) < threshW && Math.abs(eq.y - y) < threshD) {
      const top = surfaceHeight(eq, eqType);
      if (top > maxTop) { maxTop = top; result = { eq, eqType }; }
    }
  }
  return result;
}

/**
 * Compute the z-offset for an item so it stacks on top of any overlapping surface.
 * Returns 0 when there's nothing underneath.
 * Uses full AABB overlap: any part of the bounding boxes touching counts.
 */
function getMatStackZ(
  station: Station,
  excludeId: string,
  x: number,
  y: number,
  type: EquipmentType,
): number {
  let maxTop = 0;
  for (const eq of station.equipment) {
    if (eq.id === excludeId) continue;
    const eqType = getEquipmentById(eq.typeId);
    if (!eqType || !STACKABLE_SURFACE_KINDS.has(eqType.detail?.kind ?? "")) continue;
    // Any bounding-box overlap triggers stacking (AABB half-extents sum check)
    const threshW = (type.widthM + eqType.widthM) * 0.5;
    const threshD = (type.heightM + eqType.heightM) * 0.5;
    if (Math.abs(eq.x - x) < threshW && Math.abs(eq.y - y) < threshD) {
      maxTop = Math.max(maxTop, surfaceHeight(eq, eqType));
    }
  }
  return maxTop;
}
import {
  commitPlan as commitPlanStorage,
  getActivePlanId,
  getPlan,
  isCommittedPlan,
  listPlans,
  pruneUncommittedPlans,
  savePlan as savePlanStorage,
  setActivePlanId,
  deletePlan as deletePlanStorage,
} from "../lib/storage";

export type AgeGroup = "5-8" | "9-12" | "13-16";

type PlanState = {
  plan: Plan;
  selectedEquipmentId: string | null;
  snapToGrid: boolean;
  snapStepM: number;
  viewMode: ViewMode;
  equipmentEditorOpen: boolean;
  showLabels: boolean;
  showNotes: boolean;
  gameMode: boolean;
  /** True när planen har osparade ändringar. */
  isDirty: boolean;
  /**
   * Snapshot av planen som den såg ut vid senaste load/save. Används för
   * två saker: (1) detektera att namnet ändrats sedan senaste commit →
   * Spara skapar då en NY plan i stället för att skriva över; (2) kunna
   * återställa den gamla planen till sitt sparade tillstånd om användaren
   * byter namn (annars läcker autosave-ändringarna in i det gamla passet).
   */
  lastCommittedSnapshot: Plan | null;
};

type PlanActions = {
  // plan-lifecycle
  newPlan: (name?: string) => void;
  loadPlan: (id: string) => void;
  listSavedPlans: () => Plan[];
  deleteSavedPlan: (id: string) => void;
  duplicateSavedPlan: (id: string) => string | undefined;
  renamePlan: (name: string) => void;
  setHall: (hall: HallTemplate) => void;
  /** Spara nuvarande plan till localStorage (nollställer isDirty). */
  savePlan: () => void;

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
  setEquipmentNoteOffset: (id: string, offset: { x: number; y: number }) => void;
  setEquipmentNoteSize: (id: string, size: { w: number; h: number }) => void;

  // gymnasts
  addGymnast: (equipmentId: string, config: Omit<GymnastConfig, "id">) => void;
  removeGymnast: (equipmentId: string, gymnastId: string) => void;
  updateGymnast: (equipmentId: string, gymnastId: string, patch: Partial<GymnastConfig>) => void;

  // selection & settings
  selectEquipment: (id: string | null) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  openEquipmentEditor: () => void;
  closeEquipmentEditor: () => void;
  toggleLabels: () => void;
  toggleNotes: () => void;
  toggleGameMode: () => void;
  setGameMode: (on: boolean) => void;
  /** Ersätt hela planen från en extern källa (multiplayer-synk). */
  adoptRemotePlan: (plan: Plan) => void;

  // stations
  addStation: (name?: string) => string;
  selectStation: (id: string) => void;
  renameStation: (id: string, name: string) => void;
  setStationDuration: (id: string, minutes: number) => void;
  setStationNotes: (id: string, notes: string) => void;
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

function createPlan(name = "Gymnastik"): Plan {
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
  // Vi startar *bara* in i ett gammalt pass om användaren uttryckligen
  // sparat det (Ctrl/Cmd+S eller Spara-knappen). Ocommittade autosave-
  // drafts får stanna i storage som kraschskydd under sessionen, men
  // öppnas inte igen nästa gång appen startas — då får man ett tomt pass.
  const activeId = getActivePlanId();
  if (activeId && isCommittedPlan(activeId)) {
    const saved = getPlan(activeId);
    if (saved) return saved;
  }
  const list = listPlans();
  if (list.length > 0) return list[0];
  return createPlan();
}

/** Om URL:en innehåller ?room=CODE startas appen direkt i spelläget.
 *  Körs synkront vid store-init så gameMode är sann redan innan App
 *  renderas första gången – inga race conditions med useEffect. */
function initialGameMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("room");
  } catch {
    return false;
  }
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

// Städa upp gamla autosave-drafts *innan* vi väljer startpass — annars
// skulle getActivePlanId() peka på en ocommittad plan som sen ändå
// ignoreras av initialPlan(), och drafts skulle ackumuleras för evigt.
if (typeof window !== "undefined") {
  try {
    pruneUncommittedPlans();
  } catch {
    // Ignorera tyst: om storage är otillgängligt körs appen fortfarande.
  }
}

export const usePlanStore = create<PlanStore>()(
  temporal(
    (set, get) => ({
      plan: initialPlan(),
      selectedEquipmentId: null,
      snapToGrid: true,
      snapStepM: 0.25,
      viewMode: "3D" as ViewMode,
      equipmentEditorOpen: false,
      showLabels: true,
      showNotes: true,
      gameMode: initialGameMode(),
      isDirty: false,
      lastCommittedSnapshot: null,

      newPlan: (name) =>
        set(() => {
          const plan = createPlan(name);
          setActivePlanId(plan.id);
          savePlanStorage(plan);
          return {
            plan,
            selectedEquipmentId: null,
            isDirty: false,
            lastCommittedSnapshot: null,
          };
        }),

      loadPlan: (id) =>
        set(() => {
          const p = getPlan(id);
          if (!p) return {};
          setActivePlanId(p.id);
          return {
            plan: p,
            selectedEquipmentId: null,
            isDirty: false,
            // Bara committade pass listas/laddas → p är committad, använd
            // den som baslinje för att detektera namnändring.
            lastCommittedSnapshot: JSON.parse(JSON.stringify(p)) as Plan,
          };
        }),

      listSavedPlans: () => listPlans(),

      deleteSavedPlan: (id) =>
        set((state) => {
          deletePlanStorage(id);
          if (state.plan.id === id) {
            const next = createPlan();
            setActivePlanId(next.id);
            savePlanStorage(next);
            return { plan: next, selectedEquipmentId: null, isDirty: false };
          }
          return {};
        }),

      duplicateSavedPlan: (id) => {
        const source = getPlan(id);
        if (!source) return undefined;
        const copy: Plan = {
          ...source,
          id: nanoid(),
          name: `${source.name} (kopia)`,
          stations: source.stations.map((st) => ({
            ...st,
            id: nanoid(),
            equipment: st.equipment.map((e) => ({ ...e, id: nanoid() })),
          })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        // Active-station-id i kopian måste referera till den nya stationens id.
        const firstStation = copy.stations[0];
        copy.activeStationId = firstStation?.id ?? nanoid();
        savePlanStorage(copy);
        // Dupliceringen är en explicit användaråtgärd → kopian committas
        // direkt så den dyker upp i Mina pass och överlever en omstart.
        commitPlanStorage(copy.id);
        return copy.id;
      },

      renamePlan: (name) =>
        set((state) => ({
          plan: { ...state.plan, name, updatedAt: Date.now() },
        })),

      setHall: (hall) =>
        set((state) => ({
          plan: { ...state.plan, hall, updatedAt: Date.now() },
        })),

      savePlan: () =>
        set((state) => {
          const prev = state.lastCommittedSnapshot;
          const nameChanged =
            prev !== null && prev.id === state.plan.id && prev.name !== state.plan.name;
          if (nameChanged && prev) {
            // Användaren bytte namn på ett redan sparat pass → tolka som
            // "spara som". Gör nuvarande in-memory-plan till ett nytt pass
            // med nytt id och restaurera det gamla passets snapshot till
            // storage (autosave har redan hunnit skriva över det med
            // nya ändringar som egentligen hör till det nya passet).
            const newId = nanoid();
            const newPlan: Plan = {
              ...state.plan,
              id: newId,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            savePlanStorage(prev);
            commitPlanStorage(prev.id);
            savePlanStorage(newPlan);
            commitPlanStorage(newId);
            setActivePlanId(newId);
            return {
              plan: newPlan,
              isDirty: false,
              lastCommittedSnapshot: JSON.parse(JSON.stringify(newPlan)) as Plan,
            };
          }
          savePlanStorage(state.plan);
          commitPlanStorage(state.plan.id);
          setActivePlanId(state.plan.id);
          return {
            isDirty: false,
            lastCommittedSnapshot: JSON.parse(JSON.stringify(state.plan)) as Plan,
          };
        }),

      addEquipment: (typeId, xM, yM) => {
        const type = getEquipmentById(typeId);
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
        // Auto-stack for mats
        const station = state.plan.stations.find(
          (s) => s.id === state.plan.activeStationId,
        );
        const isMatKind = MAT_KINDS.has(type.detail?.kind ?? "");
        const z =
          isMatKind && station
            ? getMatStackZ(station, "", x, y, type)
            : undefined;
        const newEq: PlacedEquipment = {
          id: nanoid(),
          typeId,
          x,
          y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          ...(z !== undefined ? { z } : {}),
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
          plan: withActiveStation(s.plan, (st) => {
            const eq = st.equipment.find((e) => e.id === id);
            if (!eq) return st;
            const type = getEquipmentById(eq.typeId);
            const hall = s.plan.hall;
            // Clamp to hall bounds so the equipment can't leave the floor area
            const { x, y } = type
              ? clampToHall(xM, yM, type.widthM * eq.scaleX, type.heightM * eq.scaleY, hall.widthM, hall.heightM, eq.rotation)
              : { x: xM, y: yM };
            const isMatKind = MAT_KINDS.has(type?.detail?.kind ?? "");
            const newZ =
              isMatKind && type
                ? getMatStackZ(st, id, x, y, type)
                : eq.z;
            // Inherit tilt from an underlying tilted bench/plinth; revert to flat
            // when placed on a non-tilted surface or directly on the floor.
            let newOrientation = eq.orientation;
            if (isMatKind && type) {
              const surface = findTopSurface(st, id, x, y, type);
              const surfKind = surface?.eqType.detail?.kind ?? "";
              if (
                surface &&
                (surfKind === "gym-bench" || surfKind === "plinth") &&
                surface.eq.orientation &&
                surface.eq.orientation !== "normal"
              ) {
                newOrientation = surface.eq.orientation;
              } else {
                newOrientation = undefined; // flat surface or floor → go flat
              }
            }
            // Always bring the moved item to end of array so it renders on top
            const updated = { ...eq, x, y, z: newZ, orientation: newOrientation };
            return {
              ...st,
              equipment: [...st.equipment.filter((e) => e.id !== id), updated],
            };
          }),
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

      setEquipmentNoteOffset: (id, offset) =>
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: st.equipment.map((eq) =>
              eq.id === id ? { ...eq, noteOffset: offset } : eq,
            ),
          })),
        })),

      setEquipmentNoteSize: (id, size) =>
        set((s) => ({
          plan: withActiveStation(s.plan, (st) => ({
            ...st,
            equipment: st.equipment.map((eq) =>
              eq.id === id ? { ...eq, noteSize: size } : eq,
            ),
          })),
        })),

      addGymnast: (equipmentId, config) => {
        const state = get();
        const station = state.plan.stations.find(
          (s) => s.id === state.plan.activeStationId,
        );
        const eq = station?.equipment.find((e) => e.id === equipmentId);
        if (!eq) return;
        const gymnasts: GymnastConfig[] = [
          ...(eq.gymnasts ?? []),
          { id: nanoid(), ...config },
        ];
        state.updateEquipment(equipmentId, { gymnasts });
      },

      removeGymnast: (equipmentId, gymnastId) => {
        const state = get();
        const station = state.plan.stations.find(
          (s) => s.id === state.plan.activeStationId,
        );
        const eq = station?.equipment.find((e) => e.id === equipmentId);
        if (!eq) return;
        const gymnasts = (eq.gymnasts ?? []).filter((g) => g.id !== gymnastId);
        state.updateEquipment(equipmentId, {
          gymnasts: gymnasts.length ? gymnasts : undefined,
        });
      },

      updateGymnast: (equipmentId, gymnastId, patch) => {
        const state = get();
        const station = state.plan.stations.find(
          (s) => s.id === state.plan.activeStationId,
        );
        const eq = station?.equipment.find((e) => e.id === equipmentId);
        if (!eq) return;
        const gymnasts = (eq.gymnasts ?? []).map((g) =>
          g.id === gymnastId ? { ...g, ...patch } : g,
        );
        state.updateEquipment(equipmentId, { gymnasts });
      },

      selectEquipment: (id) => set({ selectedEquipmentId: id }),
      setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleViewMode: () =>
        set((s) => ({ viewMode: s.viewMode === "2D" ? "3D" : "2D" })),
      openEquipmentEditor: () => set({ equipmentEditorOpen: true }),
      closeEquipmentEditor: () => set({ equipmentEditorOpen: false }),
      toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
      toggleNotes: () => set((s) => ({ showNotes: !s.showNotes })),
      toggleGameMode: () => set((s) => ({ gameMode: !s.gameMode })),
      setGameMode: (on) => set({ gameMode: on }),
      adoptRemotePlan: (plan) =>
        set({ plan, selectedEquipmentId: null }),

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

      setStationNotes: (id, notes) =>
        set((s) => ({
          plan: {
            ...s.plan,
            stations: s.plan.stations.map((st) =>
              st.id === id ? { ...st, notes: notes || undefined } : st,
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
          equipmentEditorOpen: _eo,
          showLabels: _sl,
          showNotes: _sn,
          gameMode: _gm,
          ...rest
        } = state;
        void _sel; void _s; void _ss; void _vm; void _eo; void _sl; void _sn; void _gm;
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
 * Markera planen som osparad + auto-persistera till localStorage vid varje
 * planändring. Den manuella spara-knappen finns kvar för UX-klarhet, men
 * storage hålls alltid färsk — så att en oväntad reload (iOS Safari efter
 * "Visa bild"/"Hämta"-dialog, memory pressure, bakgrundsfliksväxling) inte
 * tappar pågående redigeringar.
 */
usePlanStore.subscribe((state, prev) => {
  if (state.plan === prev.plan) return;
  setActivePlanId(state.plan.id);
  if (!state.isDirty) usePlanStore.setState({ isDirty: true });
  try {
    savePlanStorage(state.plan);
  } catch {
    // LocalStorage kan vara blockerad (privat läge) — ignorera tyst.
  }
});

/** Initial persist så att nya pass listas direkt. */
if (typeof window !== "undefined") {
  try {
    savePlanStorage(usePlanStore.getState().plan);
    setActivePlanId(usePlanStore.getState().plan.id);
  } catch (err) {
    // LocalStorage kan vara blockerad (privat läge på iOS Safari t.ex.)
    // – inte ett kritiskt fel, appen fortsätter utan persist.
    // eslint-disable-next-line no-console
    console.warn("[store] kunde inte spara initialt pass:", err);
  }
}
