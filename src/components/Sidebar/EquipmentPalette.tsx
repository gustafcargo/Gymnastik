import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  CATEGORY_LABELS,
  EQUIPMENT_CATALOG,
} from "../../catalog/equipment";
import type { EquipmentType } from "../../types";
import { EquipmentIcon } from "./EquipmentIcon";
import { usePlanStore } from "../../store/usePlanStore";
import { formatMeters } from "../../lib/geometry";

type Props = {
  onItemActivate?: (typeId: string) => void;
  compact?: boolean;
};

const CATEGORY_ORDER = ["redskap", "matta", "hopp", "tillbehor"];

export function EquipmentPalette({ onItemActivate, compact }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const addEquipmentCenter = usePlanStore((s) => s.addEquipmentCenter);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EQUIPMENT_CATALOG.filter((t) => {
      if (activeCategory && t.category !== activeCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  const grouped = useMemo(() => {
    const g: Record<string, EquipmentType[]> = {};
    for (const t of filtered) {
      (g[t.category] ||= []).push(t);
    }
    return g;
  }, [filtered]);

  const handleActivate = (typeId: string) => {
    if (onItemActivate) onItemActivate(typeId);
    else addEquipmentCenter(typeId);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-3 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Redskap
        </h2>
        <div className="relative mt-2">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök redskap…"
            className="w-full rounded-lg border border-surface-3 bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:bg-white"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <CategoryChip
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          >
            Alla
          </CategoryChip>
          {CATEGORY_ORDER.map((cat) => (
            <CategoryChip
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </CategoryChip>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <section key={cat} className="py-2">
              <h3 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {CATEGORY_LABELS[cat]}
              </h3>
              <ul className={compact ? "grid grid-cols-2 gap-2 px-3" : "space-y-1 px-2"}>
                {items.map((item) => (
                  <li key={item.id}>
                    <PaletteItem
                      type={item}
                      compact={compact}
                      onActivate={() => handleActivate(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Inga redskap matchar sökningen.
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-2.5 py-1 text-xs font-medium transition " +
        (active
          ? "bg-accent text-white shadow-sm"
          : "bg-surface-2 text-slate-600 hover:bg-surface-3")
      }
    >
      {children}
    </button>
  );
}

function PaletteItem({
  type,
  onActivate,
  compact,
}: {
  type: EquipmentType;
  onActivate: () => void;
  compact?: boolean;
}) {
  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData("application/x-gymnastik-equipment", type.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={onActivate}
      className={
        "group flex w-full cursor-grab items-center gap-3 rounded-lg border border-transparent bg-white p-2 text-left shadow-xs transition hover:border-accent/40 hover:bg-accent-soft active:cursor-grabbing " +
        (compact ? "flex-col text-center" : "")
      }
      title={`Dra eller klicka för att lägga till ${type.name}`}
    >
      <div
        className={
          "flex shrink-0 items-center justify-center rounded-md bg-surface-2 " +
          (compact ? "h-14 w-14" : "h-12 w-12")
        }
      >
        <EquipmentIcon type={type} size={compact ? 40 : 36} />
      </div>
      <div className={compact ? "w-full" : "min-w-0 flex-1"}>
        <div className="truncate text-sm font-semibold text-slate-800">
          {type.name}
        </div>
        <div className="truncate text-xs text-slate-500">
          {formatMeters(type.widthM)} × {formatMeters(type.heightM)}
        </div>
      </div>
    </button>
  );
}
