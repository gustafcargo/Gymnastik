import { create } from "zustand";
import { nanoid } from "nanoid";
import type { SavedEquipmentTemplate } from "../types";
import {
  listSavedTemplates,
  saveTemplate,
  deleteTemplate,
} from "../lib/savedEquipment";

type State = {
  templates: SavedEquipmentTemplate[];
  addTemplate: (tpl: Omit<SavedEquipmentTemplate, "id" | "createdAt">) => void;
  removeTemplate: (id: string) => void;
};

export const useSavedEquipmentStore = create<State>((set) => ({
  templates: listSavedTemplates(),

  addTemplate: (tpl) => {
    const full: SavedEquipmentTemplate = {
      ...tpl,
      id: nanoid(),
      createdAt: Date.now(),
    };
    saveTemplate(full);
    set({ templates: listSavedTemplates() });
  },

  removeTemplate: (id) => {
    deleteTemplate(id);
    set({ templates: listSavedTemplates() });
  },
}));
