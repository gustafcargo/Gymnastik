import { useEffect } from "react";
import { usePlanStore, useTemporalStore } from "../store/usePlanStore";

/**
 * Globala tangentbordskortkommandon. Ignoreras om fokus ligger i ett
 * textfält (input/textarea/contenteditable).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select")
        return true;
      return el.isContentEditable;
    };

    const handler = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const store = usePlanStore.getState();
      if (store.gameMode) return; // spelläge hanterar tangenter själv
      const temporal = useTemporalStore.getState();
      const selected = store.selectedEquipmentId;

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        temporal.redo();
        return;
      }

      if (!selected) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        store.deleteEquipment(selected);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        store.duplicateEquipment(selected);
        return;
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        store.rotateEquipment(selected, e.shiftKey ? -15 : 90);
        return;
      }
      if (e.key === "Escape") {
        store.selectEquipment(null);
        return;
      }
      // Arrow-nudge
      const plan = store.plan;
      const station = plan.stations.find(
        (s) => s.id === plan.activeStationId,
      );
      const eq = station?.equipment.find((x) => x.id === selected);
      if (!eq) return;
      const stepM = e.shiftKey ? 1 : 0.1;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        store.transformEquipment(eq.id, { y: eq.y - stepM });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        store.transformEquipment(eq.id, { y: eq.y + stepM });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        store.transformEquipment(eq.id, { x: eq.x - stepM });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        store.transformEquipment(eq.id, { x: eq.x + stepM });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
