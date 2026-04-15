import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BookmarkMinus, Pencil, Plus, Trash2, Search } from "lucide-react";
import {
  CATEGORY_LABELS,
  EQUIPMENT_CATALOG,
  getEquipmentById,
} from "../../catalog/equipment";
import type { EquipmentType, SavedEquipmentTemplate } from "../../types";
import { Equipment3DThumbnail } from "./Equipment3DThumbnail";
import { usePlanStore } from "../../store/usePlanStore";
import { useSavedEquipmentStore } from "../../store/useSavedEquipmentStore";
import { useCustomEquipmentStore } from "../../store/useCustomEquipmentStore";
import { CustomEquipmentModal } from "../CustomEquipmentModal";
import { formatMeters } from "../../lib/geometry";

type Props = {
  onItemActivate?: (typeId: string) => void;
  compact?: boolean;
};

const CATEGORY_ORDER = ["redskap", "matta", "hopp", "tillbehor"];

export function EquipmentPalette({ onItemActivate, compact }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const addEquipmentCenter = usePlanStore((s) => s.addEquipmentCenter);
  const updateEquipment = usePlanStore((s) => s.updateEquipment);
  const selectEquipment = usePlanStore((s) => s.selectEquipment);
  const templates = useSavedEquipmentStore((s) => s.templates);
  const removeTemplate = useSavedEquipmentStore((s) => s.removeTemplate);
  const customTypes = useCustomEquipmentStore((s) => s.customTypes);
  const removeCustomType = useCustomEquipmentStore((s) => s.removeCustomType);

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

  const filteredCustom = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (activeCategory && activeCategory !== "eget") return [];
    return customTypes.filter((t) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q),
    );
  }, [query, activeCategory, customTypes]);

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

  const handleTemplateEdit = (tpl: SavedEquipmentTemplate) => {
    const id = addEquipmentCenter(tpl.baseTypeId);
    if (id) {
      updateEquipment(id, {
        label: tpl.name,
        customColor: tpl.customColor,
        partColors: tpl.partColors,
        params: tpl.params,
        z: tpl.z,
        notes: tpl.notes,
        templateId: tpl.id,
      });
      selectEquipment(id);
    }
    if (onItemActivate) onItemActivate(tpl.baseTypeId);
  };

  const hasAnyResults =
    filtered.length > 0 || filteredCustom.length > 0 || templates.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-3 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Redskap
          </h2>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-ink hover:bg-accent hover:text-white transition"
            title="Skapa nytt eget redskap"
          >
            <Plus size={12} /> Nytt
          </button>
        </div>
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
          {customTypes.length > 0 && (
            <CategoryChip
              active={activeCategory === "eget"}
              onClick={() => setActiveCategory("eget")}
            >
              {CATEGORY_LABELS["eget"]}
            </CategoryChip>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* ── Sparade mallar ── */}
        {templates.length > 0 && (!activeCategory || activeCategory === null) && (
          <section className="border-b border-surface-3 py-2">
            <h3 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-accent">
              Sparade mallar
            </h3>
            <ul className={compact ? "grid grid-cols-2 gap-2 px-3" : "space-y-1 px-2"}>
              {templates.map((tpl) => {
                const baseType = getEquipmentById(tpl.baseTypeId);
                if (!baseType) return null;
                const displayType: EquipmentType = {
                  ...baseType,
                  color: tpl.customColor ?? baseType.color,
                };
                return (
                  <li key={tpl.id}>
                    <TemplateItem
                      tpl={tpl}
                      baseType={displayType}
                      compact={compact}
                      onActivate={() => handleTemplateActivate(tpl)}
                      onEdit={() => handleTemplateEdit(tpl)}
                      onDelete={() => removeTemplate(tpl.id)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Egna redskap ── */}
        {filteredCustom.length > 0 && (
          <section className="border-b border-surface-3 py-2">
            <h3 className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-purple-500">
              {CATEGORY_LABELS["eget"]}
            </h3>
            <ul className={compact ? "grid grid-cols-2 gap-2 px-3" : "space-y-1 px-2"}>
              {filteredCustom.map((item) => (
                <li key={item.id}>
                  <PaletteItem
                    type={item}
                    compact={compact}
                    onActivate={() => handleActivate(item.id)}
                    onDelete={() => removeCustomType(item.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Standardkatalog ── */}
        {CATEGORY_ORDER.map((cat) => {
          if (activeCategory === "eget") return null;
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

        {!hasAnyResults && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Inga redskap matchar sökningen.
          </p>
        )}
      </div>

      {showNewModal && createPortal(
        <CustomEquipmentModal onClose={() => setShowNewModal(false)} />,
        document.body,
      )}
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
  onEdit,
  onDelete,
  compact,
}: {
  tpl: SavedEquipmentTemplate;
  baseType: EquipmentType;
  onActivate: () => void;
  onEdit: () => void;
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
            "shrink-0 overflow-hidden rounded-md bg-surface-2 " +
            (compact ? "h-14 w-14" : "h-10 w-10")
          }
        >
          <Equipment3DThumbnail type={baseType} size={compact ? 56 : 40} color={tpl.customColor} partColors={tpl.partColors} params={tpl.params} />
        </div>
        <div className={compact ? "w-full" : "min-w-0 flex-1"}>
          <div className="truncate text-sm font-semibold text-accent-ink">
            {tpl.name}
          </div>
          <div className="truncate text-xs text-slate-500">{baseType.name}</div>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Redigera mall"
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-blue-100 hover:text-blue-600"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Ta bort mall"
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-red-100 hover:text-red-600"
        >
          <BookmarkMinus size={14} />
        </button>
      </div>
    </div>
  );
}

function PaletteItem({
  type,
  onActivate,
  onDelete,
  compact,
}: {
  type: EquipmentType;
  onActivate: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
    e.dataTransfer.setData("application/x-gymnastik-equipment", type.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={
        "group flex w-full cursor-grab items-center gap-3 rounded-lg border border-transparent bg-white p-2 text-left shadow-xs transition hover:border-accent/40 hover:bg-accent-soft active:cursor-grabbing " +
        (compact ? "flex-col text-center" : "")
      }
      draggable
      onDragStart={handleDragStart}
      title={`Dra eller klicka för att lägga till ${type.name}`}
    >
      <button
        type="button"
        onClick={onActivate}
        className={
          "flex min-w-0 flex-1 items-center gap-3 text-left " +
          (compact ? "flex-col" : "")
        }
      >
        <div
          className={
            "shrink-0 overflow-hidden rounded-md bg-surface-2 " +
            (compact ? "h-14 w-14" : "h-12 w-12")
          }
        >
          <Equipment3DThumbnail type={type} size={compact ? 56 : 48} />
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
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Ta bort "${type.name}"?`)) onDelete();
          }}
          title="Ta bort eget redskap"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
