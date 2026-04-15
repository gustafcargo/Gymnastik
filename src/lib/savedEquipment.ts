import type { SavedEquipmentTemplate } from "../types";

const KEY = "gymnastik.savedEquipment.v1";

function readAll(): SavedEquipmentTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedEquipmentTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedEquipmentTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function listSavedTemplates(): SavedEquipmentTemplate[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function saveTemplate(tpl: SavedEquipmentTemplate) {
  const list = readAll().filter((t) => t.id !== tpl.id);
  writeAll([tpl, ...list]);
}

export function deleteTemplate(id: string) {
  writeAll(readAll().filter((t) => t.id !== id));
}
