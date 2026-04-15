import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { usePlanStore } from "../store/usePlanStore";
import type { Plan } from "../types";

type Props = { onClose: () => void };

export function PlansModal({ onClose }: Props) {
  const listSavedPlans = usePlanStore((s) => s.listSavedPlans);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const deleteSavedPlan = usePlanStore((s) => s.deleteSavedPlan);
  const newPlan = usePlanStore((s) => s.newPlan);
  const currentId = usePlanStore((s) => s.plan.id);

  const [tick, setTick] = useState(0);
  const plans = useMemo<Plan[]>(() => listSavedPlans(), [tick, listSavedPlans]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3">
          <h2 className="text-lg font-semibold">Mina pass</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-surface-2"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="flex-1 divide-y divide-surface-3 overflow-y-auto scrollbar-thin">
          {plans.map((p) => (
            <li
              key={p.id}
              className={
                "flex items-center gap-3 px-5 py-3 " +
                (p.id === currentId ? "bg-accent-soft/60" : "")
              }
            >
              <button
                type="button"
                onClick={() => {
                  loadPlan(p.id);
                  onClose();
                }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">
                  {p.stations.length} station{p.stations.length === 1 ? "" : "er"}
                  {" · "}
                  {p.hall.name}
                  {" · "}
                  {new Date(p.updatedAt).toLocaleDateString("sv-SE")}
                </div>
              </button>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Ta bort pass"
                onClick={() => {
                  if (confirm(`Ta bort "${p.name}"?`)) {
                    deleteSavedPlan(p.id);
                    setTick((t) => t + 1);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
          {plans.length === 0 && (
            <li className="p-8 text-center text-sm text-slate-400">
              Inga sparade pass än.
            </li>
          )}
        </ul>
        <div className="border-t border-surface-3 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              newPlan();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-ink"
          >
            <Plus size={15} /> Nytt pass
          </button>
        </div>
      </div>
    </div>
  );
}
