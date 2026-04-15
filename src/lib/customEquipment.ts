import type { EquipmentType } from "../types";

const KEY = "gymnastik.customEquipment.v1";

export function listCustomTypes(): EquipmentType[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EquipmentType[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomType(t: EquipmentType): void {
  const list = listCustomTypes().filter((x) => x.id !== t.id);
  list.push(t);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function deleteCustomType(id: string): void {
  const list = listCustomTypes().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}
