import type { Plan } from "../types";

const STORAGE_KEY = "gymnastik.plans.v1";
const ACTIVE_KEY = "gymnastik.activePlan.v1";

type StoredPlans = Record<string, Plan>;

function readRaw(): StoredPlans {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as StoredPlans;
  } catch {
    return {};
  }
}

function writeRaw(plans: StoredPlans) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

export function listPlans(): Plan[] {
  return Object.values(readRaw()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function savePlan(plan: Plan) {
  const plans = readRaw();
  plans[plan.id] = { ...plan, updatedAt: Date.now() };
  writeRaw(plans);
}

export function getPlan(id: string): Plan | undefined {
  return readRaw()[id];
}

export function deletePlan(id: string) {
  const plans = readRaw();
  delete plans[id];
  writeRaw(plans);
}

export function setActivePlanId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_KEY, id);
}

export function getActivePlanId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}
