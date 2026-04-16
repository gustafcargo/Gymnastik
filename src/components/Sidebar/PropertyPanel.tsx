import { useState } from "react";
import { BookmarkPlus, Copy, Pencil, Plus, RotateCw, Trash2, X } from "lucide-react";
import { nanoid } from "nanoid";
import { usePlanStore } from "../../store/usePlanStore";
import { useSavedEquipmentStore } from "../../store/useSavedEquipmentStore";
import { getEquipmentById } from "../../catalog/equipment";
import { EQUIPMENT_PARTS } from "../../catalog/equipmentParts";
import { EQUIPMENT_PARAMS } from "../../catalog/equipmentParams";
import { exercisesForKind } from "../../catalog/exercises";
import type { Exercise } from "../../catalog/exercises";
import { formatMeters } from "../../lib/geometry";
import type { CustomEquipmentPart, GymnastConfig, EquipmentType } from "../../types";
import { CustomEquipmentModal } from "../CustomEquipmentModal";

type Props = {
  onClose?: () => void;
};

export function PropertyPanel({ onClose }: Props) {
  const plan = usePlanStore((s) => s.plan);
  const selectedId = usePlanStore((s) => s.selectedEquipmentId);
  const updateEquipment = usePlanStore((s) => s.updateEquipment);
  const transformEquipment = usePlanStore((s) => s.transformEquipment);
  const deleteEquipment = usePlanStore((s) => s.deleteEquipment);
  const duplicateEquipment = usePlanStore((s) => s.duplicateEquipment);
  const rotateEquipment = usePlanStore((s) => s.rotateEquipment);

  const addGymnast    = usePlanStore((s) => s.addGymnast);
  const removeGymnast = usePlanStore((s) => s.removeGymnast);
  const updateGymnast = usePlanStore((s) => s.updateGymnast);

  const addTemplate = useSavedEquipmentStore((s) => s.addTemplate);
  const updateTemplateFn = useSavedEquipmentStore((s) => s.updateTemplate);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [updatedFeedback, setUpdatedFeedback] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  const station = plan.stations.find((s) => s.id === plan.activeStationId);
  const selected = station?.equipment.find((e) => e.id === selectedId) ?? null;
  const type = selected ? (getEquipmentById(selected.typeId) ?? null) : null;

  if (!selected || !type) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Egenskaper" onClose={onClose} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-slate-400">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2">
            <svg
              width={30}
              height={30}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M4 12h16" />
              <path d="M12 4v16" />
            </svg>
          </div>
          <p className="text-sm">
            Markera ett redskap på hallen för att ändra dess egenskaper.
          </p>
        </div>
      </div>
    );
  }

  const widthM = type.widthM * selected.scaleX;
  const heightM = type.heightM * selected.scaleY;

  const handleSaveTemplate = () => {
    addTemplate({
      name: selected.label ?? type.name,
      baseTypeId: selected.typeId,
      customColor: selected.customColor,
      partColors: selected.partColors,
      params: selected.params,
      z: selected.z,
      notes: selected.notes,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleUpdateTemplate = () => {
    if (!selected.templateId) return;
    updateTemplateFn(selected.templateId, {
      name: selected.label ?? type.name,
      customColor: selected.customColor,
      partColors: selected.partColors,
      params: selected.params,
      z: selected.z,
      notes: selected.notes,
    });
    setUpdatedFeedback(true);
    setTimeout(() => setUpdatedFeedback(false), 2000);
  };

  return (
    <div className="flex h-full flex-col">
      <Header title="Egenskaper" onClose={onClose} />

      {/* Equipment name + editable label */}
      <div className="flex items-center gap-3 border-b border-surface-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={selected.label ?? type.name}
            onChange={(e) =>
              updateEquipment(selected.id, { label: e.target.value })
            }
            className="w-full border-b border-transparent bg-transparent text-base font-semibold outline-none focus:border-accent"
          />
          <p className="mt-0.5 text-xs text-slate-500">{type.name}</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">

        <Field label="Storlek (m)">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Bredd"
              value={widthM}
              step={0.1}
              min={0.2}
              onChange={(v) =>
                transformEquipment(selected.id, {
                  scaleX: Math.max(0.3, v / type.widthM),
                })
              }
            />
            <NumberInput
              label="Djup"
              value={heightM}
              step={0.1}
              min={0.2}
              onChange={(v) =>
                transformEquipment(selected.id, {
                  scaleY: Math.max(0.3, v / type.heightM),
                })
              }
            />
          </div>
          {(selected.scaleX !== 1 || selected.scaleY !== 1) && (
            <button
              type="button"
              onClick={() =>
                transformEquipment(selected.id, { scaleX: 1, scaleY: 1 })
              }
              className="mt-1.5 text-xs text-accent hover:underline"
            >
              Återställ till standardmått ({formatMeters(type.widthM)} ×{" "}
              {formatMeters(type.heightM)})
            </button>
          )}
          {selected.scaleX === 1 && selected.scaleY === 1 && (
            <p className="mt-1 text-xs text-slate-400">
              Standardmått för {type.name}
            </p>
          )}
        </Field>

        <Field label="Rotation">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={Math.round(selected.rotation)}
              onChange={(e) =>
                transformEquipment(selected.id, {
                  rotation: Number(e.target.value),
                })
              }
              className="flex-1"
            />
            <input
              type="number"
              min={0}
              max={360}
              step={5}
              value={Math.round(selected.rotation)}
              onChange={(e) =>
                transformEquipment(selected.id, {
                  rotation: Number(e.target.value),
                })
              }
              className="w-16 rounded-md border border-surface-3 bg-surface-2 px-2 py-1 text-sm text-right"
            />
            <button
              type="button"
              onClick={() => rotateEquipment(selected.id, 90)}
              className="grid h-8 w-8 place-items-center rounded-md border border-surface-3 bg-white text-slate-600 transition hover:bg-surface-2"
              title="Rotera 90°"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </Field>

        <Field label="Höjd (över golv, m)">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={selected.z ?? 0}
              onChange={(e) =>
                updateEquipment(selected.id, { z: Number(e.target.value) })
              }
              className="flex-1"
            />
            <input
              type="number"
              min={0}
              max={3}
              step={0.05}
              value={Number((selected.z ?? 0).toFixed(2))}
              onChange={(e) =>
                updateEquipment(selected.id, { z: Math.max(0, Number(e.target.value)) })
              }
              className="w-16 rounded-md border border-surface-3 bg-surface-2 px-2 py-1 text-right text-sm"
            />
          </div>
        </Field>

        <Field label="Orientering">
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { value: "normal",        label: "Upprätt" },
                { value: "upside-down",   label: "Upp-och-ned" },
                { value: "on-long-side",  label: "På kortsida" },
                { value: "on-short-side", label: "På lång sida" },
              ] as const
            ).map(({ value, label }) => {
              const current = selected.orientation ?? "normal";
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    updateEquipment(selected.id, {
                      orientation: value === "normal" ? undefined : value,
                    })
                  }
                  className={
                    "rounded-lg border px-2 py-1.5 text-xs font-medium transition " +
                    (current === value
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-surface-3 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        {type.detail?.kind && (EQUIPMENT_PARAMS[type.detail.kind]?.length ?? 0) > 0 && (
          <GeometryParamsSection
            kind={type.detail.kind}
            params={selected.params}
            onChange={(key, value) =>
              updateEquipment(selected.id, {
                params: { ...selected.params, [key]: value },
              })
            }
            onReset={(key) => {
              const { [key]: _, ...rest } = selected.params ?? {};
              void _;
              updateEquipment(selected.id, {
                params: Object.keys(rest).length ? rest : undefined,
              });
            }}
          />
        )}

        <Field label="Huvudfärg">
          <ColorPicker
            value={selected.customColor ?? type.color}
            isCustom={!!selected.customColor}
            onChange={(c) => updateEquipment(selected.id, { customColor: c })}
            onReset={() => updateEquipment(selected.id, { customColor: undefined })}
          />
        </Field>

        {type.detail?.kind && EQUIPMENT_PARTS[type.detail.kind] && (
          <PartColorsSection
            kind={type.detail.kind}
            partColors={selected.partColors}
            onChange={(key, color) =>
              updateEquipment(selected.id, {
                partColors: { ...selected.partColors, [key]: color },
              })
            }
            onReset={(key) => {
              const { [key]: _, ...rest } = selected.partColors ?? {};
              void _;
              updateEquipment(selected.id, {
                partColors: Object.keys(rest).length ? rest : undefined,
              });
            }}
          />
        )}

        {(() => {
          const kind = type.detail?.kind ?? "";
          const exercises = kind ? exercisesForKind(kind) : [];
          if (exercises.length === 0) return null;
          return (
            <GymnastsSection
              gymnasts={selected.gymnasts ?? []}
              exercises={exercises}
              onAdd={() =>
                addGymnast(selected.id, {
                  exerciseId: exercises[0].id,
                  color: "#C2185B",
                })
              }
              onRemove={(gid) => removeGymnast(selected.id, gid)}
              onUpdate={(gid, patch) => updateGymnast(selected.id, gid, patch)}
            />
          );
        })()}

        <Field label="Anteckningar">
          <textarea
            value={selected.notes ?? ""}
            onChange={(e) =>
              updateEquipment(selected.id, { notes: e.target.value })
            }
            rows={3}
            placeholder="T.ex. övning, ansvarig tränare, säkerhet…"
            className="w-full resize-y rounded-lg border border-surface-3 bg-surface-2 p-2 text-sm outline-none focus:border-accent focus:bg-white"
          />
        </Field>
      </div>

      {/* Footer: template + duplicate/delete */}
      <div className="space-y-2 border-t border-surface-3 p-3">
        {selected.templateId ? (
          <button
            type="button"
            onClick={handleUpdateTemplate}
            className={
              "flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition " +
              (updatedFeedback
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20")
            }
          >
            <BookmarkPlus size={15} />
            {updatedFeedback ? "Mall uppdaterad!" : "Uppdatera mall"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSaveTemplate}
            className={
              "flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition " +
              (savedFeedback
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20")
            }
          >
            <BookmarkPlus size={15} />
            {savedFeedback ? "Sparad som mall!" : "Spara som mall"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setBuilderOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-100"
        >
          <Pencil size={15} /> Öppna i redskapsbyggaren
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => duplicateEquipment(selected.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-surface-3 bg-white py-2 text-sm font-medium text-slate-700 transition hover:bg-surface-2"
          >
            <Copy size={15} /> Duplicera
          </button>
          <button
            type="button"
            onClick={() => deleteEquipment(selected.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            <Trash2 size={15} /> Ta bort
          </button>
        </div>
      </div>
      {builderOpen && (
        <CustomEquipmentModal
          onClose={() => setBuilderOpen(false)}
          initialParts={equipmentTypeToCustomParts(type)}
          initialName={selected.label ?? type.name}
        />
      )}
    </div>
  );
}

/** Konverterar katalog-utrustningstyp till enkel CustomEquipmentPart[]-approximation. */
function equipmentTypeToCustomParts(type: EquipmentType): CustomEquipmentPart[] {
  // Om redan custom med delar, återanvänd dem
  if (type.customParts?.length) return type.customParts.map(p => ({ ...p, id: nanoid(6) }));
  // Annars: skapa grundform baserat på dimensioner
  return [{
    id: nanoid(6), shape: "box" as const,
    offsetX: 0, offsetY: 0, offsetZ: 0,
    w: type.widthM, h: type.physicalHeightM, d: type.heightM,
    color: type.color,
  }];
}

function PartColorsSection({
  kind,
  partColors,
  onChange,
  onReset,
}: {
  kind: string;
  partColors: Record<string, string> | undefined;
  onChange: (key: string, color: string) => void;
  onReset: (key: string) => void;
}) {
  const parts = EQUIPMENT_PARTS[kind];
  if (!parts) return null;
  return (
    <Field label="Delarnas färger">
      <div className="space-y-3">
        {Object.entries(parts).map(([key, defaultColor]) => {
          const current = partColors?.[key] ?? defaultColor;
          const isCustom = !!partColors?.[key];
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium capitalize text-slate-600">
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => onReset(key)}
                    className="text-xs text-accent hover:underline"
                  >
                    Återställ
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={current}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="h-7 w-8 cursor-pointer rounded border border-surface-3 p-0.5"
                />
                <div className="flex flex-wrap gap-1">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => onChange(key, c)}
                      className="h-5 w-5 rounded transition hover:scale-110"
                      style={{
                        background: c,
                        outline: current === c ? "2px solid #3B82F6" : "none",
                        outlineOffset: "1px",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
}

function GeometryParamsSection({
  kind,
  params,
  onChange,
  onReset,
}: {
  kind: string;
  params: Record<string, number> | undefined;
  onChange: (key: string, value: number) => void;
  onReset: (key: string) => void;
}) {
  const defs = EQUIPMENT_PARAMS[kind];
  if (!defs || defs.length === 0) return null;
  return (
    <Field label="Geometri">
      <div className="space-y-4">
        {defs.map((def) => {
          const value = params?.[def.key] ?? def.defaultValue;
          const isCustom = params?.[def.key] !== undefined;
          return (
            <div key={def.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">{def.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">
                    {value % 1 === 0 ? value : value.toFixed(2)} {def.unit}
                  </span>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => onReset(def.key)}
                      className="text-xs text-accent hover:underline"
                    >
                      Återställ
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min={def.min}
                max={def.max}
                step={def.step}
                value={value}
                onChange={(e) => onChange(def.key, Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{def.min} {def.unit}</span>
                <span>{def.max} {def.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
}

function Header({
  title,
  onClose,
}: {
  title: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-surface-2"
          aria-label="Stäng"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const COLOR_PRESETS = [
  "#CC2020", "#E86020", "#D4A020", "#4A9A38",
  "#2878C0", "#7B4FA6", "#C04878", "#8C6240",
  "#4F7A9A", "#252D3A", "#788C9E", "#E8EDF3",
];

function ColorPicker({
  value,
  isCustom,
  onChange,
  onReset,
}: {
  value: string;
  isCustom: boolean;
  onChange: (c: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-6 gap-1.5">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className="h-7 w-full rounded-md border transition hover:scale-110"
            style={{
              background: c,
              borderColor: value === c ? "#0B3FA8" : "rgba(0,0,0,0.15)",
              boxShadow: value === c ? "0 0 0 2px #3B82F6" : undefined,
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-surface-3 p-0.5"
          title="Välj anpassad färg"
        />
        <span className="font-mono text-xs text-slate-500">{value.toUpperCase()}</span>
        {isCustom && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-xs text-accent hover:underline"
          >
            Återställ
          </button>
        )}
      </div>
    </div>
  );
}

function GymnastsSection({
  gymnasts,
  exercises,
  onAdd,
  onRemove,
  onUpdate,
}: {
  gymnasts: GymnastConfig[];
  exercises: Exercise[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<GymnastConfig>) => void;
}) {
  const MAX = 1;
  return (
    <Field label="Gymnaster">
      <div className="space-y-2">
        {gymnasts.map((g) => (
          <div
            key={g.id}
            className="flex items-center gap-2 rounded-lg border border-surface-3 bg-surface-2 p-2"
          >
            <input
              type="color"
              value={g.color ?? "#C2185B"}
              onChange={(e) => onUpdate(g.id, { color: e.target.value })}
              className="h-7 w-8 shrink-0 cursor-pointer rounded border border-surface-3 p-0.5"
              title="Dräktfärg"
            />
            <select
              value={g.exerciseId}
              onChange={(e) => onUpdate(g.id, { exerciseId: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-surface-3 bg-white py-1 pl-2 pr-1 text-sm outline-none focus:border-accent"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onRemove(g.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              title="Ta bort"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {gymnasts.length < MAX && (
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-3 py-2 text-sm text-slate-500 transition hover:border-accent hover:text-accent"
          >
            <Plus size={14} /> Lägg till gymnast
          </button>
        )}
      </div>
    </Field>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step = 0.1,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-0.5 text-[11px] font-medium text-slate-500">
        {label}
      </span>
      <input
        type="number"
        step={step}
        min={min}
        value={Number(value.toFixed(2))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-surface-3 bg-surface-2 px-2 py-1.5 text-sm font-mono text-slate-800 outline-none focus:border-accent focus:bg-white"
      />
    </label>
  );
}
