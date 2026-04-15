import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { nanoid } from "nanoid";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useCustomEquipmentStore } from "../store/useCustomEquipmentStore";
import type {
  CustomEquipmentPart,
  EquipmentCategory,
  EquipmentShape,
} from "../types";
import { Equipment3D } from "./Canvas3D/Equipment3D";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORIES: { id: EquipmentCategory; label: string }[] = [
  { id: "redskap", label: "Redskap" },
  { id: "matta", label: "Matta" },
  { id: "hopp", label: "Hopp" },
  { id: "tillbehor", label: "Tillbehör" },
];

const SHAPES: { id: EquipmentShape; label: string }[] = [
  { id: "roundedRect", label: "Rundad" },
  { id: "rect", label: "Rektangel" },
  { id: "ellipse", label: "Ellips" },
];

const PART_SHAPES = [
  { id: "box" as const, label: "Kub/Balk" },
  { id: "cylinder" as const, label: "Cylinder" },
  { id: "sphere" as const, label: "Sfär" },
];

const COLOR_PRESETS = [
  "#CC2020", "#E86020", "#D4A020", "#4A9A38",
  "#2878C0", "#7B4FA6", "#C04878", "#8C6240",
  "#4F7A9A", "#252D3A", "#788C9E", "#B5894F",
];

function newPart(): CustomEquipmentPart {
  return {
    id: nanoid(6),
    shape: "box",
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    w: 0.8,
    h: 1.0,
    d: 0.6,
    color: undefined,
  };
}

/** Compute footprint & physical height from parts list. */
function calcDimensions(parts: CustomEquipmentPart[]) {
  if (parts.length === 0) return { widthM: 1, heightM: 1, physicalHeightM: 1 };
  let maxX = 0, maxZ = 0, maxH = 0;
  for (const p of parts) {
    const hw = p.w / 2;
    const hd = p.shape === "box" ? p.d / 2 : p.w / 2;
    maxX = Math.max(maxX, Math.abs(p.offsetX) + hw);
    maxZ = Math.max(maxZ, Math.abs(p.offsetZ) + hd);
    maxH = Math.max(maxH, p.offsetY + p.h);
  }
  return {
    widthM: Math.max(0.2, maxX * 2),
    heightM: Math.max(0.2, maxZ * 2),
    physicalHeightM: Math.max(0.1, maxH),
  };
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

type Props = { onClose: () => void };

export function CustomEquipmentModal({ onClose }: Props) {
  const addCustomType = useCustomEquipmentStore((s) => s.addCustomType);

  const [name, setName] = useState("Eget redskap");
  const [category, setCategory] = useState<EquipmentCategory>("redskap");
  const [footprintShape, setFootprintShape] = useState<EquipmentShape>("roundedRect");
  const [baseColor, setBaseColor] = useState("#788C9E");
  const [desc, setDesc] = useState("");
  const [parts, setParts] = useState<CustomEquipmentPart[]>([newPart()]);
  const [expandedId, setExpandedId] = useState<string | null>(parts[0]?.id ?? null);

  const dims = calcDimensions(parts);

  const previewType = {
    id: "__preview__",
    name,
    category,
    widthM: dims.widthM,
    heightM: dims.heightM,
    physicalHeightM: dims.physicalHeightM,
    color: baseColor,
    shape: footprintShape,
    customParts: parts,
  };
  const camDist = Math.max(dims.widthM, dims.heightM, dims.physicalHeightM, 0.5) * 2.2;
  const targetY = dims.physicalHeightM / 2;

  const handleCreate = () => {
    addCustomType({
      name: name.trim() || "Eget redskap",
      category,
      widthM: dims.widthM,
      heightM: dims.heightM,
      physicalHeightM: dims.physicalHeightM,
      color: baseColor,
      shape: footprintShape,
      description: desc || undefined,
      customParts: parts,
    });
    onClose();
  };

  const updatePart = (id: string, patch: Partial<CustomEquipmentPart>) => {
    setParts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addPart = () => {
    const p = newPart();
    setParts((ps) => [...ps, p]);
    setExpandedId(p.id);
  };

  const removePart = (id: string) => {
    setParts((ps) => ps.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-slate-500 hover:bg-surface-3"
        >
          <X size={16} />
        </button>

        {/* ── Left: properties + parts ── */}
        <div className="flex w-80 shrink-0 flex-col border-r border-surface-3">
          <div className="border-b border-surface-3 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Skapa eget redskap
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-3 bg-surface-2 px-3 py-1.5 text-sm font-semibold outline-none focus:border-accent"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 px-4 py-3">
            {/* Category */}
            <Prop label="Kategori">
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={chip(category === c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Prop>

            {/* 2D footprint shape */}
            <Prop label="2D-form">
              <div className="flex gap-1">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFootprintShape(s.id)}
                    className={chip(footprintShape === s.id) + " flex-1"}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Prop>

            {/* Base color */}
            <Prop label="Standardfärg">
              <div className="grid grid-cols-6 gap-1">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBaseColor(c)}
                    className="h-6 w-full rounded border-2 transition hover:scale-110"
                    style={{
                      background: c,
                      borderColor: baseColor === c ? "#2563EB" : "transparent",
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="color"
                  value={baseColor}
                  onChange={(e) => setBaseColor(e.target.value)}
                  className="h-7 w-8 cursor-pointer rounded border border-surface-3 p-0.5"
                />
                <span className="font-mono text-xs text-slate-400">
                  {baseColor.toUpperCase()}
                </span>
              </div>
            </Prop>

            {/* Description */}
            <Prop label="Beskrivning">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                placeholder="Valfri beskrivning…"
                className="w-full resize-none rounded-lg border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
              />
            </Prop>

            {/* Parts */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Delar ({parts.length})
                </p>
                <button
                  type="button"
                  onClick={addPart}
                  className="flex items-center gap-0.5 rounded bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink hover:bg-accent hover:text-white transition"
                >
                  <Plus size={11} /> Ny del
                </button>
              </div>
              <div className="space-y-1.5">
                {parts.map((p, i) => (
                  <PartEditor
                    key={p.id}
                    part={p}
                    index={i}
                    baseColor={baseColor}
                    expanded={expandedId === p.id}
                    onToggle={() =>
                      setExpandedId(expandedId === p.id ? null : p.id)
                    }
                    onChange={(patch) => updatePart(p.id, patch)}
                    onDelete={parts.length > 1 ? () => removePart(p.id) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-surface-3 px-4 py-3">
            <button
              type="button"
              onClick={handleCreate}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-ink"
            >
              Spara redskap
            </button>
          </div>
        </div>

        {/* ── Right: 3D preview ── */}
        <div className="relative flex flex-1 flex-col bg-slate-950">
          <div className="border-b border-slate-800 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Förhandsgranskning
            </p>
            <p className="text-xs text-slate-400">
              {dims.widthM.toFixed(2)} × {dims.heightM.toFixed(2)} m · {dims.physicalHeightM.toFixed(2)} m hög
            </p>
          </div>
          <div className="relative min-h-0 flex-1">
            <Canvas
              shadows
              gl={{ antialias: true }}
              camera={{
                position: [camDist * 0.7, camDist * 0.55, camDist],
                fov: 42,
                near: 0.05,
                far: 200,
              }}
              style={{ position: "absolute", inset: 0 }}
            >
              <color attach="background" args={["#090d14"]} />
              <ambientLight intensity={0.45} />
              <directionalLight
                position={[3, 6, 4]}
                intensity={1.6}
                castShadow
                shadow-mapSize={[512, 512]}
              />
              <hemisphereLight intensity={0.25} groundColor="#1a2030" color="#8aabcc" />
              <Suspense fallback={null}>
                <Environment preset="city" background={false} environmentIntensity={0.4} />
              </Suspense>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
                <planeGeometry args={[dims.widthM * 4 + 2, dims.heightM * 4 + 2]} />
                <meshPhysicalMaterial color="#1e2a38" roughness={0.5} />
              </mesh>
              <Equipment3D type={previewType} color={baseColor} />
              <OrbitControls
                target={[0, targetY, 0]}
                autoRotate
                autoRotateSpeed={1.2}
                enablePan={false}
                maxPolarAngle={Math.PI / 2 - 0.02}
              />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PartEditor
// ---------------------------------------------------------------------------

function PartEditor({
  part,
  index,
  baseColor,
  expanded,
  onToggle,
  onChange,
  onDelete,
}: {
  part: CustomEquipmentPart;
  index: number;
  baseColor: string;
  expanded: boolean;
  onToggle: () => void;
  onChange: (p: Partial<CustomEquipmentPart>) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-3 bg-surface-2">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span className="text-xs font-semibold text-slate-700">
            Del {index + 1} — {PART_SHAPES.find((s) => s.id === part.shape)?.label}
          </span>
          <span
            className="ml-1 inline-block h-3 w-3 rounded-full border border-slate-300"
            style={{ background: part.color ?? baseColor }}
          />
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-red-100 hover:text-red-600"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div className="space-y-3 border-t border-surface-3 bg-white px-3 py-3">
          {/* Shape */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Form
            </label>
            <div className="flex gap-1">
              {PART_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ shape: s.id })}
                  className={chip(part.shape === s.id) + " flex-1 text-[11px]"}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Färg
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={part.color ?? baseColor}
                onChange={(e) => onChange({ color: e.target.value })}
                className="h-7 w-8 cursor-pointer rounded border border-surface-3 p-0.5"
              />
              {part.color && (
                <button
                  type="button"
                  onClick={() => onChange({ color: undefined })}
                  className="text-[11px] text-blue-500 hover:underline"
                >
                  Standardfärg
                </button>
              )}
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Storlek (m)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <NumField
                label={part.shape === "cylinder" || part.shape === "sphere" ? "Diam." : "Bredd"}
                value={part.w}
                min={0.05}
                max={10}
                step={0.05}
                onChange={(v) => onChange({ w: v })}
              />
              <NumField
                label="Höjd"
                value={part.h}
                min={0.05}
                max={10}
                step={0.05}
                onChange={(v) => onChange({ h: v })}
              />
              {part.shape === "box" && (
                <NumField
                  label="Djup"
                  value={part.d}
                  min={0.05}
                  max={10}
                  step={0.05}
                  onChange={(v) => onChange({ d: v })}
                />
              )}
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Position (m)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <NumField
                label="↔ X"
                value={part.offsetX}
                min={-8}
                max={8}
                step={0.05}
                onChange={(v) => onChange({ offsetX: v })}
              />
              <NumField
                label="↑ Y"
                value={part.offsetY}
                min={0}
                max={8}
                step={0.05}
                onChange={(v) => onChange({ offsetY: v })}
              />
              <NumField
                label="↕ Z"
                value={part.offsetZ}
                min={-8}
                max={8}
                step={0.05}
                onChange={(v) => onChange({ offsetZ: v })}
              />
            </div>
          </div>

          {/* Rotation */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Rotation Y (°)
            </label>
            <NumField
              label="°"
              value={part.rotationY ?? 0}
              min={-180}
              max={180}
              step={5}
              onChange={(v) => onChange({ rotationY: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function chip(active: boolean) {
  return (
    "rounded-md border px-2 py-1 text-xs font-medium transition " +
    (active
      ? "border-accent bg-accent-soft text-accent-ink"
      : "border-surface-3 bg-white text-slate-600 hover:border-accent/40")
  );
}

function Prop({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider text-slate-400">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-surface-3 bg-surface-2 px-1.5 py-1 text-xs font-mono outline-none focus:border-accent"
      />
    </label>
  );
}
