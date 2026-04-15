import { create } from "zustand";
import { nanoid } from "nanoid";
import type { EquipmentType } from "../types";
import {
  listCustomTypes,
  saveCustomType,
  deleteCustomType,
} from "../lib/customEquipment";
import { registerEquipmentType, unregisterEquipmentType } from "../catalog/equipment";

// Register any previously saved custom types immediately on module load.
listCustomTypes().forEach(registerEquipmentType);

type State = {
  customTypes: EquipmentType[];
  addCustomType: (t: Omit<EquipmentType, "id">) => EquipmentType;
  removeCustomType: (id: string) => void;
};

export const useCustomEquipmentStore = create<State>((set) => ({
  customTypes: listCustomTypes(),

  addCustomType: (partial) => {
    const t: EquipmentType = { ...partial, id: `custom-${nanoid(8)}` };
    registerEquipmentType(t);
    saveCustomType(t);
    set((s) => ({ customTypes: [...s.customTypes, t] }));
    return t;
  },

  removeCustomType: (id) => {
    unregisterEquipmentType(id);
    deleteCustomType(id);
    set((s) => ({ customTypes: s.customTypes.filter((t) => t.id !== id) }));
  },
}));
