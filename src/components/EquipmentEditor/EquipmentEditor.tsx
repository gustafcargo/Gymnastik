import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { BookmarkPlus, Copy, Trash2, X } from "lucide-react";
import { usePlanStore } from "../../store/usePlanStore";
import { useSavedEquipmentStore } from "../../store/useSavedEquipmentStore";
import { getEquipmentById } from "../../catalog/equipment";
import { EQUIPMENT_PARTS } from "../../catalog/equipmentParts";
import { EQUIPMENT_PARAMS } from "../../catalog/equipmentParams";
import { Equipment3D } from "../Canvas3D/Equipment3D";

const COLOR_PRESETS = [
  "#CC2020", "#E86020", "#D4A020", "#4A9A38",
  "#2878C0", "#7B4FA6", "#C04878", "#8C6240",
  "#4F7A9A", "#252D3A", "#788C9E", "#E8EDF3",
];

export function EquipmentEditor() {
  const equipmentEditorOpen = usePlanStore((s) => s.equipmentEditorOpen);
  const closeEquipmentEditor = usePlanStore((s) => s.closeEquipmentEditor);
  const plan = usePlanStore((s) => s.plan);
  const selectedId = usePlanStore((s) => s.selectedEquipmentId);
  const updateEquipment = usePlanStore((s) => s.updateEquipment);
  const deleteEquipment = usePlanStore((s) => s.deleteEquipment);
  const duplicateEquipment = usePlanStore((s) => s.duplicateEquipment);
  const addTemplate = useSavedEquipmentStore((s) => s.addTemplate);
  const updateTemplateFn = useSavedEquipmentStore((s) => s.updateTemplate);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [updatedFeedback, setUpdatedFeedback] = useState(false);

  const station = plan.stations.find((s) => s.id === plan.activeStationId);
  const selected = station?.equipment.find((e) => e.id === selectedId) ?? null;
  const type = selected ? getEquipmentById(selected.typeId) ?? null : null;

  // Close editor if equipment no longer available
  useEffect(() => {
    if (equipmentEditorOpen && (!selected || !type)) {
      closeEquipmentEditor();
    }
  }, [equipmentEditorOpen, selected, type, closeEquipmentEditor]);

  // ESC to close
  useEffect(() => {
    if (!equipmentEditorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEquipmentEditor();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [equipmentEditorOpen, closeEquipmentEditor]);

  if (!equipmentEditorOpen || !selected || !type) return null;

  const kind = type.detail?.kind;
  const parts = kind ? EQUIPMENT_PARTS[kind] : undefined;
  const paramDefs = kind ? EQUIPMENT_PARAMS[kind] : undefined;

  const maxDim = Math.max(type.widthM, type.heightM, type.physicalHeightM, 0.5);
  const camDist = maxDim * 2.5;
  const targetY = type.physicalHeightM / 2;

  const handleDelete = () => {
    closeEquipmentEditor();
    deleteEquipment(selected.id);
  };

  const handleDuplicate = () => {
    duplicateEquipment(selected.id);
    closeEquipmentEditor();
  };

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={closeEquipmentEditor}
    >
      <div
        className="relative flex h-[82vh] max-h-[700px] w-full max-w-3xl overflow-hidden rounded-2xl bg-slate-900 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeEquipmentEditor}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
        >
          <X size={16} />
        </button>

        {/* ── Left: 3D preview ── */}
        <div className="hidden w-56 shrink-0 flex-col bg-slate-950 sm:flex">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Förhandsgranskning
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold">
              {selected.label ?? type.name}
            </p>
          </div>
          <div className="relative min-h-0 flex-1">
            <Canvas
              shadows
              gl={{ antialias: true }}
              camera={{
                position: [camDist * 0.65, Math.max(targetY, camDist * 0.4), camDist],
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

              {/* Subtle floor plane */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
                <planeGeometry args={[maxDim * 4, maxDim * 4]} />
                <meshPhysicalMaterial color="#1e2a38" roughness={0.5} metalness={0} />
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
          </div>
          <div className="border-t border-slate-800 px-4 py-2.5 text-center">
            <p className="text-[11px] text-slate-600">
              {type.widthM} × {type.heightM} m · {type.physicalHeightM} m hög
            </p>
          </div>
        </div>

        {/* ── Right: settings panel ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-slate-800 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Redigera redskap
            </p>
            <h2 className="mt-0.5 text-base font-bold">{type.name}</h2>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* Label */}
            <Section label="Etikett">
              <input
                type="text"
                value={selected.label ?? ""}
                placeholder={type.name}
                onChange={(e) =>
                  updateEquipment(selected.id, { label: e.target.value || undefined })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </Section>

            {/* Orientation */}
            <Section label="Orientering">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(
                  [
                    { value: "normal",       label: "Upprätt" },
                    { value: "upside-down",  label: "Upp-och-ned" },
                    { value: "on-long-side", label: "På lång sida" },
                    { value: "on-short-side",label: "På kortsida" },
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
                          ? "border-blue-500 bg-blue-900/50 text-blue-300"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200")
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Z-height for stacking */}
            <Section label="Höjd från golvet (m)">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={4}
                  step={0.05}
                  value={Number((selected.z ?? 0).toFixed(2))}
                  onChange={(e) =>
                    updateEquipment(selected.id, { z: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-slate-100 outline-none focus:border-blue-500"
                />
                {(selected.z ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => updateEquipment(selected.id, { z: 0 })}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Återställ
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Flytta redskapet uppåt för att stapla på andra redskap.
              </p>
            </Section>

            {/* Main color */}
            <Section label="Huvudfärg">
              <div className="grid grid-cols-6 gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateEquipment(selected.id, { customColor: c })}
                    className="h-7 w-full rounded-md border-2 transition hover:scale-110"
                    style={{
                      background: c,
                      borderColor:
                        (selected.customColor ?? type.color) === c
                          ? "#60A5FA"
                          : "transparent",
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={selected.customColor ?? type.color}
                  onChange={(e) =>
                    updateEquipment(selected.id, { customColor: e.target.value })
                  }
                  className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-slate-800 p-0.5"
                />
                <span className="font-mono text-xs text-slate-400">
                  {(selected.customColor ?? type.color).toUpperCase()}
                </span>
                {selected.customColor && (
                  <button
                    type="button"
                    onClick={() => updateEquipment(selected.id, { customColor: undefined })}
                    className="ml-auto text-xs text-blue-400 hover:underline"
                  >
                    Återställ
                  </button>
                )}
              </div>
            </Section>

            {/* Per-part colors */}
            {parts && (
              <Section label="Delarnas färger">
                <div className="space-y-3">
                  {Object.entries(parts).map(([key, defaultColor]) => {
                    const current = selected.partColors?.[key] ?? defaultColor;
                    const isCustom = !!selected.partColors?.[key];
                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium capitalize text-slate-400">
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </span>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => {
                                const { [key]: _, ...rest } = selected.partColors ?? {};
                                void _;
                                updateEquipment(selected.id, {
                                  partColors: Object.keys(rest).length ? rest : undefined,
                                });
                              }}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              Återställ
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={current}
                            onChange={(e) =>
                              updateEquipment(selected.id, {
                                partColors: { ...selected.partColors, [key]: e.target.value },
                              })
                            }
                            className="h-7 w-8 cursor-pointer rounded border border-slate-700 bg-slate-800 p-0.5"
                          />
                          <div className="flex flex-wrap gap-1">
                            {COLOR_PRESETS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                title={c}
                                onClick={() =>
                                  updateEquipment(selected.id, {
                                    partColors: { ...selected.partColors, [key]: c },
                                  })
                                }
                                className="h-5 w-5 rounded transition hover:scale-110"
                                style={{
                                  background: c,
                                  outline: current === c ? "2px solid #60A5FA" : "none",
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
              </Section>
            )}

            {/* Geometry params */}
            {paramDefs && paramDefs.length > 0 && (
              <Section label="Geometriparametrar">
                <div className="space-y-4">
                  {paramDefs.map((def) => {
                    const value = selected.params?.[def.key] ?? def.defaultValue;
                    return (
                      <div key={def.key}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-400">
                            {def.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-400">
                              {value.toFixed(2)} {def.unit}
                            </span>
                            {selected.params?.[def.key] !== undefined && (
                              <button
                                type="button"
                                onClick={() => {
                                  const { [def.key]: _, ...rest } = selected.params ?? {};
                                  void _;
                                  updateEquipment(selected.id, {
                                    params: Object.keys(rest).length ? rest : undefined,
                                  });
                                }}
                                className="text-xs text-blue-400 hover:underline"
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
                          onChange={(e) =>
                            updateEquipment(selected.id, {
                              params: { ...selected.params, [def.key]: Number(e.target.value) },
                            })
                          }
                          className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>
                            {def.min} {def.unit}
                          </span>
                          <span>
                            {def.max} {def.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Notes */}
            <Section label="Anteckningar">
              <textarea
                value={selected.notes ?? ""}
                onChange={(e) =>
                  updateEquipment(selected.id, { notes: e.target.value || undefined })
                }
                rows={3}
                placeholder="T.ex. övning, säkerhet, ansvarig tränare…"
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
            </Section>
          </div>

          {/* Footer */}
          <div className="space-y-2 border-t border-slate-800 p-4">
            {selected.templateId ? (
              <button
                type="button"
                onClick={handleUpdateTemplate}
                className={
                  "flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition " +
                  (updatedFeedback
                    ? "border-green-700 bg-green-900/50 text-green-400"
                    : "border-blue-700/50 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50")
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
                    ? "border-green-700 bg-green-900/50 text-green-400"
                    : "border-blue-700/50 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50")
                }
              >
                <BookmarkPlus size={15} />
                {savedFeedback ? "Sparad som mall!" : "Spara som mall"}
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDuplicate}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
              >
                <Copy size={15} /> Duplicera
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/60 py-2 text-sm font-medium text-red-400 transition hover:bg-red-900/60"
              >
                <Trash2 size={15} /> Ta bort
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}
