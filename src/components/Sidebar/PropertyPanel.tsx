import { Copy, RotateCw, Trash2, X } from "lucide-react";
import { usePlanStore } from "../../store/usePlanStore";
import { EQUIPMENT_BY_ID } from "../../catalog/equipment";
import { formatMeters } from "../../lib/geometry";
import { EquipmentIcon } from "./EquipmentIcon";

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

  const station = plan.stations.find((s) => s.id === plan.activeStationId);
  const selected = station?.equipment.find((e) => e.id === selectedId) ?? null;
  const type = selected ? EQUIPMENT_BY_ID[selected.typeId] : null;

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

  return (
    <div className="flex h-full flex-col">
      <Header title="Egenskaper" onClose={onClose} />

      <div className="flex items-center gap-3 border-b border-surface-3 px-4 py-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-surface-2">
          <EquipmentIcon type={type} size={44} />
        </div>
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
        <Field label="Position (m)">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="X"
              value={selected.x}
              step={0.25}
              onChange={(v) => transformEquipment(selected.id, { x: v })}
            />
            <NumberInput
              label="Y"
              value={selected.y}
              step={0.25}
              onChange={(v) => transformEquipment(selected.id, { y: v })}
            />
          </div>
        </Field>

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

        <Field label="Färg">
          <ColorPicker
            value={selected.customColor ?? type.color}
            isCustom={!!selected.customColor}
            onChange={(c) => updateEquipment(selected.id, { customColor: c })}
            onReset={() => updateEquipment(selected.id, { customColor: undefined })}
          />
        </Field>

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

      <div className="flex gap-2 border-t border-surface-3 p-3">
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
