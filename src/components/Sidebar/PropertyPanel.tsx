import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { BookmarkPlus, Copy, RotateCw, Trash2, X } from "lucide-react";
import { usePlanStore } from "../../store/usePlanStore";
import { useSavedEquipmentStore } from "../../store/useSavedEquipmentStore";
import { getEquipmentById } from "../../catalog/equipment";
import { EQUIPMENT_PARTS } from "../../catalog/equipmentParts";
import { EQUIPMENT_PARAMS } from "../../catalog/equipmentParams";
import { formatMeters } from "../../lib/geometry";
import { Equipment3D } from "../Canvas3D/Equipment3D";

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

  const addTemplate = useSavedEquipmentStore((s) => s.addTemplate);
  const updateTemplateFn = useSavedEquipmentStore((s) => s.updateTemplate);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [updatedFeedback, setUpdatedFeedback] = useState(false);

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

  const maxDim = Math.max(type.widthM, type.heightM, type.physicalHeightM, 0.5);
  const camDist = maxDim * 2.5;
  const targetY = type.physicalHeightM / 2;

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

        {/* ── Interactive 3D preview ── */}
        <div className="relative h-44 overflow-hidden rounded-xl bg-slate-950">
          <Canvas
            shadows
            gl={{ antialias: true }}
            camera={{
              position: [
                camDist * 0.65,
                Math.max(targetY, camDist * 0.4),
                camDist,
              ],
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
            <hemisphereLight
              intensity={0.25}
              groundColor="#1a2030"
              color="#8aabcc"
            />
            <Suspense fallback={null}>
              <Environment
                preset="city"
                background={false}
                environmentIntensity={0.4}
              />
            </Suspense>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.005, 0]}
              receiveShadow
            >
              <planeGeometry args={[maxDim * 4, maxDim * 4]} />
              <meshPhysicalMaterial
                color="#1e2a38"
                roughness={0.5}
                metalness={0}
              />
            </mesh>
            <Equipment3D
              type={type}
              color={selected.customColor}
              partColors={selected.partColors}
              params={selected.params}
            />
            <OrbitControls
              target={[0, targetY, 0]}
              autoRotate
              autoRotateSpeed={1.4}
              enablePan={false}
              minDistance={maxDim * 0.6}
              maxDistance={maxDim * 8}
              maxPolarAngle={Math.PI / 2 - 0.02}
            />
          </Canvas>
          <p className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-slate-500">
            {type.widthM} × {type.heightM} m · {type.physicalHeightM} m hög
          </p>
        </div>

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
          <div className="mt-2">
            <NumberInput
              label="Höjd (stapel, m)"
              value={selected.z ?? 0}
              step={0.05}
              min={0}
              onChange={(v) => updateEquipment(selected.id, { z: Math.max(0, v) })}
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

        <Field label="Orientering">
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { value: "normal",        label: "Upprätt" },
                { value: "upside-down",   label: "Upp-och-ned" },
                { value: "on-long-side",  label: "På lång sida" },
                { value: "on-short-side", label: "På kortsida" },
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
    </div>
  );
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
