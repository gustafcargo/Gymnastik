import type { PlacedEquipment } from "../types";
import { getEquipmentById } from "../catalog/equipment";

const MAT_KINDS = new Set(["thick-mat", "landing-mat"]);

export type StackInfo = {
  /** Total number of mats in this stack (1 = not stacked). */
  count: number;
  /** True for the topmost mat in the stack (the one that should show the label). */
  isLeader: boolean;
};

/**
 * Computes stacking groups for mat equipment using the same center-proximity
 * threshold as getMatStackZ.  Returns a Map keyed by equipment ID.
 * Non-mat equipment is not included — callers can treat absence as count=1/isLeader=true.
 */
export function computeStackInfo(
  equipment: PlacedEquipment[],
): Map<string, StackInfo> {
  const mats = equipment.filter((eq) => {
    const t = getEquipmentById(eq.typeId);
    return t && MAT_KINDS.has(t.detail?.kind ?? "");
  });

  // Union-Find
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  for (const m of mats) parent.set(m.id, m.id);

  for (let i = 0; i < mats.length; i++) {
    for (let j = i + 1; j < mats.length; j++) {
      const a = mats[i], b = mats[j];
      const ta = getEquipmentById(a.typeId)!;
      const tb = getEquipmentById(b.typeId)!;
      const threshW = Math.min(ta.widthM, tb.widthM) * 0.5;
      const threshD = Math.min(ta.heightM, tb.heightM) * 0.5;
      if (Math.abs(a.x - b.x) < threshW && Math.abs(a.y - b.y) < threshD) {
        union(a.id, b.id);
      }
    }
  }

  // Group by root
  const groups = new Map<string, PlacedEquipment[]>();
  for (const m of mats) {
    const root = find(m.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(m);
  }

  const result = new Map<string, StackInfo>();
  for (const [, group] of groups) {
    const count = group.length;
    // Leader = highest z; tiebreak by last in array (most recently placed)
    let leader = group[0];
    for (const m of group) {
      if ((m.z ?? 0) >= (leader.z ?? 0)) leader = m;
    }
    for (const m of group) {
      result.set(m.id, { count, isLeader: m.id === leader.id });
    }
  }

  return result;
}
