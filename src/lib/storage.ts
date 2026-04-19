import type { Plan } from "../types";

const STORAGE_KEY = "gymnastik.plans.v1";
const ACTIVE_KEY = "gymnastik.activePlan.v1";
const COMMITTED_KEY = "gymnastik.committedPlans.v1";

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

function readCommittedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COMMITTED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeCommittedSet(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMMITTED_KEY, JSON.stringify([...ids]));
}

/** Returnerar bara pass som användaren uttryckligen sparat (commit). */
export function listPlans(): Plan[] {
  const committed = readCommittedSet();
  return Object.values(readRaw())
    .filter((p) => committed.has(p.id))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Skriver plan-innehåll till localStorage. Tänkt för *autosave* — passet
 * hamnar inte i "Mina pass" och återöppnas inte efter en full nedstängning
 * av appen förrän commitPlan() körts (via den explicita Spara-knappen).
 */
export function savePlan(plan: Plan) {
  const plans = readRaw();
  plans[plan.id] = { ...plan, updatedAt: Date.now() };
  writeRaw(plans);
}

/** Markerar ett pass som uttryckligen sparat — visas i Mina pass + återöppnas. */
export function commitPlan(id: string) {
  const committed = readCommittedSet();
  if (!committed.has(id)) {
    committed.add(id);
    writeCommittedSet(committed);
  }
}

export function isCommittedPlan(id: string): boolean {
  return readCommittedSet().has(id);
}

export function getPlan(id: string): Plan | undefined {
  return readRaw()[id];
}

export function deletePlan(id: string) {
  const plans = readRaw();
  delete plans[id];
  writeRaw(plans);
  const committed = readCommittedSet();
  if (committed.delete(id)) writeCommittedSet(committed);
}

/**
 * Tar bort alla icke-committade utkast ur storage. Körs vid app-start så
 * gamla autosave-drafts (som användaren aldrig valde att spara) inte
 * ackumuleras i localStorage över tid.
 */
export function pruneUncommittedPlans() {
  const committed = readCommittedSet();
  const plans = readRaw();
  let changed = false;
  for (const id of Object.keys(plans)) {
    if (!committed.has(id)) {
      delete plans[id];
      changed = true;
    }
  }
  if (changed) writeRaw(plans);
}

export function setActivePlanId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_KEY, id);
}

export function getActivePlanId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}
