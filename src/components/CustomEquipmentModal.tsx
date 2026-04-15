import { useState } from "react";
import { X } from "lucide-react";
import { useCustomEquipmentStore } from "../store/useCustomEquipmentStore";
import type { EquipmentCategory, EquipmentShape } from "../types";

const CATEGORIES: { id: EquipmentCategory; label: string }[] = [
  { id: "redskap", label: "Redskap" },
  { id: "matta", label: "Matta" },
  { id: "hopp", label: "Hopp" },
  { id: "tillbehor", label: "Tillbehör" },
];

const SHAPES: { id: EquipmentShape; label: string }[] = [
  { id: "rect", label: "Rektangel" },
  { id: "roundedRect", label: "Rundad rektangel" },
  { id: "ellipse", label: "Ellips" },
];

const COLOR_PRESETS = [
  "#CC2020", "#E86020", "#D4A020", "#4A9A38",
  "#2878C0", "#7B4FA6", "#C04878", "#8C6240",
  "#4F7A9A", "#252D3A", "#788C9E", "#B5894F",
];

type Props = { onClose: () => void };

export function CustomEquipmentModal({ onClose }: Props) {
  const addCustomType = useCustomEquipmentStore((s) => s.addCustomType);

  const [name, setName] = useState("Eget redskap");
  const [category, setCategory] = useState<EquipmentCategory>("redskap");
  const [widthM, setWidthM] = useState(1.5);
  const [heightM, setHeightM] = useState(1.0);
  const [physH, setPhysH] = useState(1.0);
  const [color, setColor] = useState("#788C9E");
  const [shape, setShape] = useState<EquipmentShape>("roundedRect");
  const [desc, setDesc] = useState("");

  const handleCreate = () => {
    addCustomType({
      name: name.trim() || "Eget redskap",
      category,
      widthM: Math.max(0.1, widthM),
      heightM: Math.max(0.1, heightM),
      physicalHeightM: Math.max(0, physH),
      color,
      shape,
      description: desc || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-slate-500 hover:bg-surface-3"
        >
          <X size={16} />
        </button>

        <div className="border-b border-surface-3 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Skapa nytt redskap
          </p>
          <h2 className="mt-0.5 text-base font-bold text-slate-800">
            Eget redskap
          </h2>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4" style={{ maxHeight: "68vh" }}>
          {/* Name */}
          <Field label="Namn">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>

          {/* Category */}
          <Field label="Kategori">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={
                    "rounded-md border px-3 py-1 text-xs font-medium transition " +
                    (category === c.id
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-surface-3 bg-white text-slate-600 hover:border-accent/40")
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Dimensions */}
          <Field label="Fotavtryck (meter)">
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] text-slate-400">Bredd</span>
                <input
                  type="number"
                  min={0.1}
                  max={30}
                  step={0.1}
                  value={widthM}
                  onChange={(e) => setWidthM(Number(e.target.value))}
                  className="rounded-lg border border-surface-3 bg-surface-2 px-2 py-1.5 text-sm font-mono outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] text-slate-400">Djup</span>
                <input
                  type="number"
                  min={0.1}
                  max={30}
                  step={0.1}
                  value={heightM}
                  onChange={(e) => setHeightM(Number(e.target.value))}
                  className="rounded-lg border border-surface-3 bg-surface-2 px-2 py-1.5 text-sm font-mono outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] text-slate-400">Höjd (3D)</span>
                <input
                  type="number"
                  min={0}
                  max={8}
                  step={0.05}
                  value={physH}
                  onChange={(e) => setPhysH(Number(e.target.value))}
                  className="rounded-lg border border-surface-3 bg-surface-2 px-2 py-1.5 text-sm font-mono outline-none focus:border-accent"
                />
              </label>
            </div>
          </Field>

          {/* Shape */}
          <Field label="Form">
            <div className="flex gap-2">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShape(s.id)}
                  className={
                    "flex-1 rounded-md border py-1.5 text-xs font-medium transition " +
                    (shape === s.id
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-surface-3 bg-white text-slate-600 hover:border-accent/40")
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Color */}
          <Field label="Färg">
            <div className="grid grid-cols-6 gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-full rounded-md border-2 transition hover:scale-110"
                  style={{
                    background: c,
                    borderColor: color === c ? "#2563EB" : "transparent",
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-surface-3 p-0.5"
              />
              <span className="font-mono text-xs text-slate-400">
                {color.toUpperCase()}
              </span>
            </div>
          </Field>

          {/* Description */}
          <Field label="Beskrivning (valfri)">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Kort beskrivning av redskapet…"
              className="w-full resize-none rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>
        </div>

        <div className="border-t border-surface-3 px-5 py-3">
          <button
            type="button"
            onClick={handleCreate}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-ink"
          >
            Skapa redskap
          </button>
        </div>
      </div>
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
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}
