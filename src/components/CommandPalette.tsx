import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { EQUIPMENT_CATALOG } from "../catalog/equipment";
import { HALL_TEMPLATES } from "../catalog/halls";
import { usePlanStore } from "../store/usePlanStore";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const addEquipmentCenter = usePlanStore((s) => s.addEquipmentCenter);
  const addStation = usePlanStore((s) => s.addStation);
  const setHall = usePlanStore((s) => s.setHall);
  const newPlan = usePlanStore((s) => s.newPlan);
  const plan = usePlanStore((s) => s.plan);
  const selectStation = usePlanStore((s) => s.selectStation);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) return null;

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/30 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Kommandopalett">
          <Command.Input
            placeholder="Sök åtgärd eller redskap…"
            className="w-full border-b border-surface-3 px-4 py-3 text-base outline-none"
            autoFocus
          />
          <Command.List className="max-h-80 overflow-y-auto p-1 scrollbar-thin">
            <Command.Empty className="px-4 py-6 text-center text-sm text-slate-400">
              Inget hittades.
            </Command.Empty>

            <Command.Group heading="Åtgärder">
              <Item onSelect={() => run(() => newPlan())}>Nytt pass</Item>
              <Item
                onSelect={() =>
                  run(() =>
                    window.dispatchEvent(
                      new CustomEvent("gymnastik:fit-view"),
                    ),
                  )
                }
              >
                Passa vyn
              </Item>
              <Item onSelect={() => run(() => addStation())}>
                Lägg till station
              </Item>
            </Command.Group>

            <Command.Group heading="Byt hallmall">
              {HALL_TEMPLATES.map((h) => (
                <Item key={h.id} onSelect={() => run(() => setHall(h))}>
                  {h.name}
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="Hoppa till station">
              {plan.stations.map((st, i) => (
                <Item
                  key={st.id}
                  onSelect={() => run(() => selectStation(st.id))}
                >
                  {i + 1}. {st.name}
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="Lägg till redskap">
              {EQUIPMENT_CATALOG.map((t) => (
                <Item
                  key={t.id}
                  onSelect={() => run(() => addEquipmentCenter(t.id))}
                >
                  + {t.name}
                </Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Item({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-accent-soft aria-selected:text-accent-ink"
    >
      {children}
    </Command.Item>
  );
}
