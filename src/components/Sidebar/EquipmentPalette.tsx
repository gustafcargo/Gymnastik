import { useMemo, useState } from "react";
import { BookmarkMinus, Search } from "lucide-react";
import {
  CATEGORY_LABELS,
  EQUIPMENT_BY_ID,
  EQUIPMENT_CATALOG,
} from "../../catalog/equipment";
import type { EquipmentType, SavedEquipmentTemplate } from "../../types";
import { EquipmentIcon } from "./EquipmentIcon";
import { usePlanStore } from "../../store/usePlanStore";
import { useSavedEquipmentStore } from "../../store/useSavedEquipmentStore";
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
  const updateEquipment = usePlanStore((s) => s.updateEquipment);
  const templates = useSavedEquipmentStore((s) => s.templates);
  const removeTemplate = useSavedEquipmentStore((s) => s.removeTemplate);

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

  const handleTemplateActivate = (tpl: SavedEquipmentTemplate) => {
    const id = addEquipmentCenter(tpl.baseTypeId);
    if (id) {
      updateEquipment(id, {
        label: tpl.name,
        customColor: tpl.customColor,
        partColors: tpl.partColors,
        params: tpl.params,
        z: tpl.z,
        notes: tpl.notes,
      });
    }
    if (onItemActivate) onItemActivate(tpl.baseTypeId);
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
        {/* ── Sparade mallar ── */}
        {templates.length > 0 && (
          <section className="border-b border-surface-3 py-2">
            <h3 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-accent">
              Sparade mallar
            </h3>
            <ul className={compact ? "grid grid-cols-2 gap-2 px-3" : "space-y-1 px-2"}>
              {templates.map((tpl) => {
                const baseType = EQUIPMENT_BY_ID[tpl.baseTypeId];
                if (!baseType) return null;
                // Build a display type that reflects the template's custom color
                const displayType: EquipmentType = { ...baseType, color: tpl.customColor ?? baseType.color };
                return (
                  <li key={tpl.id}>
                    <TemplateItem
                      tpl={tpl}
                      baseType={displayType}
                      compact={compact}
                      onActivate={() => handleTemplateActivate(tpl)}
                      onDelete={() => removeTemplate(tpl.id)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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

function TemplateItem({
  tpl,
  baseType,
  onActivate,
  onDelete,
  compact,
}: {
  tpl: SavedEquipmentTemplate;
  baseType: EquipmentType;
  onActivate: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        "group flex w-full items-center gap-2 rounded-lg border border-accent/20 bg-accent-soft p-2 " +
        (compact ? "flex-col text-center" : "")
      }
    >
      <button
        type="button"
        onClick={onActivate}
        className={
          "flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left " +
          (compact ? "flex-col" : "")
        }
        title={`Lägg till ${tpl.name}`}
      >
        <div
          className={
            "flex shrink-0 items-center justify-center rounded-md bg-surface-2 " +
            (compact ? "h-14 w-14" : "h-10 w-10")
          }
        >
          <EquipmentIcon type={baseType} size={compact ? 36 : 28} />
        </div>
        <div className={compact ? "w-full" : "min-w-0 flex-1"}>
          <div className="truncate text-sm font-semibold text-accent-ink">{tpl.name}</div>
          <div className="truncate text-xs text-slate-500">{baseType.name}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Ta bort mall"
        className="shrink-0 grid h-7 w-7 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
      >
        <BookmarkMinus size={14} />
      </button>
    </div>
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
