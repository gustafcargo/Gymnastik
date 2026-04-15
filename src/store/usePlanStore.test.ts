import { describe, it, expect, beforeEach } from "vitest";
import { usePlanStore } from "./usePlanStore";

function resetStore() {
  usePlanStore.getState().newPlan("Testpass");
}

describe("usePlanStore", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("adds equipment to active station", () => {
    const id = usePlanStore.getState().addEquipment("barr", 5, 5);
    expect(id).toBeDefined();
    const plan = usePlanStore.getState().plan;
    const station = plan.stations.find((s) => s.id === plan.activeStationId);
    expect(station?.equipment).toHaveLength(1);
    expect(station?.equipment[0].typeId).toBe("barr");
  });

  it("duplicates, then deletes", () => {
    const id = usePlanStore.getState().addEquipment("trampett", 5, 5)!;
    const dupId = usePlanStore.getState().duplicateEquipment(id);
    expect(dupId).toBeDefined();
    const plan = usePlanStore.getState().plan;
    const station = plan.stations.find((s) => s.id === plan.activeStationId)!;
    expect(station.equipment).toHaveLength(2);
    usePlanStore.getState().deleteEquipment(dupId!);
    const after = usePlanStore.getState().plan.stations.find(
      (s) => s.id === usePlanStore.getState().plan.activeStationId,
    )!;
    expect(after.equipment).toHaveLength(1);
  });

  it("creates and switches stations", () => {
    const sid = usePlanStore.getState().addStation("Station B");
    expect(usePlanStore.getState().plan.activeStationId).toBe(sid);
    expect(usePlanStore.getState().plan.stations).toHaveLength(2);
  });

  it("renames the plan", () => {
    usePlanStore.getState().renamePlan("Lördagspass");
    expect(usePlanStore.getState().plan.name).toBe("Lördagspass");
  });
});
