import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { nanoid } from "nanoid";
import { ChevronDown, ChevronUp, Copy, Plus, Redo2, Trash2, Undo2, X } from "lucide-react";
import { useCustomEquipmentStore } from "../store/useCustomEquipmentStore";
import type {
  CustomEquipmentPart,
  EquipmentCategory,
  EquipmentShape,
} from "../types";

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
  { id: "cone" as const, label: "Kon" },
  { id: "torus" as const, label: "Torus" },
  { id: "wedge" as const, label: "Kil" },
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
    const hd =
      p.shape === "box" || p.shape === "wedge" ? p.d / 2
      : p.shape === "torus" ? p.w / 2
      : p.w / 2;
    maxX = Math.max(maxX, Math.abs(p.offsetX) + hw);
    maxZ = Math.max(maxZ, Math.abs(p.offsetZ) + hd);
    maxH = Math.max(maxH, p.shape === "torus" ? p.offsetY + p.d / 2 : p.offsetY + p.h);
  }
  return {
    widthM: Math.max(0.2, maxX * 2),
    heightM: Math.max(0.2, maxZ * 2),
    physicalHeightM: Math.max(0.1, maxH),
  };
}

// ---------------------------------------------------------------------------
// WedgeGeom – right-triangular prism, centered at bounding-box center
// ---------------------------------------------------------------------------

function WedgeGeom({ w, h, d }: { w: number; h: number; d: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([
      -w/2, -h/2,  d/2,
       w/2, -h/2,  d/2,
      -w/2, -h/2, -d/2,
       w/2, -h/2, -d/2,
      -w/2,  h/2, -d/2,
       w/2,  h/2, -d/2,
    ]);
    const idx = new Uint16Array([
      0,3,1, 0,2,3,
      2,4,5, 2,5,3,
      0,1,5, 0,5,4,
      0,4,2,
      1,3,5,
    ]);
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }, [w, h, d]);
  return <primitive object={geom} />;
}

// ---------------------------------------------------------------------------
// 3D Preview scene (must be inside Canvas to use useThree)
// ---------------------------------------------------------------------------

type DragState = {
  partId: string;
  plane: THREE.Plane;
  hitOffX: number;
  hitOffZ: number;
};

function PreviewScene({
  parts,
  baseColor,
  selectedPartId,
  onSelectPart,
  onUpdatePartXZ,
  orbitRef,
}: {
  parts: CustomEquipmentPart[];
  baseColor: string;
  selectedPartId: string | null;
  onSelectPart: (id: string) => void;
  onUpdatePartXZ: (id: string, offsetX: number, offsetZ: number) => void;
  orbitRef: React.RefObject<OrbitControlsImpl>;
}) {
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = new THREE.Vector3();
      if (raycaster.current.ray.intersectPlane(dragRef.current.plane, hit)) {
        onUpdatePartXZ(
          dragRef.current.partId,
          hit.x - dragRef.current.hitOffX,
          hit.z - dragRef.current.hitOffZ,
        );
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        if (orbitRef.current) orbitRef.current.enabled = true;
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, onUpdatePartXZ, orbitRef]);

  return (
    <>
      {parts.map((p) => {
        const isSelected = selectedPartId === p.id;
        const mat = (
          <meshPhysicalMaterial
            color={p.color ?? baseColor}
            roughness={0.45}
            metalness={0.05}
            emissive={isSelected ? "#3B82F6" : "#000000"}
            emissiveIntensity={isSelected ? 0.35 : 0}
          />
        );
        return (
          <group
            key={p.id}
            position={[p.offsetX, p.offsetY + (p.shape === "torus" ? 0 : p.h / 2), p.offsetZ]}
            rotation={[0, ((p.rotationY ?? 0) * Math.PI) / 180, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectPart(p.id);
              if (orbitRef.current) orbitRef.current.enabled = false;
              const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(p.offsetY));
              dragRef.current = {
                partId: p.id,
                plane,
                hitOffX: e.point.x - p.offsetX,
                hitOffZ: e.point.z - p.offsetZ,
              };
            }}
          >
            <mesh castShadow receiveShadow>
              {p.shape === "cylinder" ? (
                <cylinderGeometry args={[p.w / 2, p.w / 2, p.h, 24]} />
              ) : p.shape === "sphere" ? (
                <sphereGeometry args={[p.w / 2, 24, 16]} />
              ) : p.shape === "cone" ? (
                <coneGeometry args={[p.w / 2, p.h, 24]} />
              ) : p.shape === "torus" ? (
                <torusGeometry args={[p.w / 2, Math.max(0.01, p.d / 4), 16, 48]} />
              ) : p.shape === "wedge" ? (
                <WedgeGeom w={p.w} h={p.h} d={p.d} />
              ) : (
                <boxGeometry args={[p.w, p.h, p.d]} />
              )}
              {mat}
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Undo/redo reducer for parts
// ---------------------------------------------------------------------------
type PartsState = { parts: CustomEquipmentPart[]; past: CustomEquipmentPart[][]; future: CustomEquipmentPart[][] };
type PartsAction =
  | { type: "set"; parts: CustomEquipmentPart[] }
  | { type: "undo" }
  | { type: "redo" };

function partsReducer(s: PartsState, a: PartsAction): PartsState {
  switch (a.type) {
    case "set":
      return { parts: a.parts, past: [...s.past.slice(-30), s.parts], future: [] };
    case "undo":
      if (!s.past.length) return s;
      return { parts: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.parts, ...s.future] };
    case "redo":
      if (!s.future.length) return s;
      return { parts: s.future[0], past: [...s.past, s.parts], future: s.future.slice(1) };
  }
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

type Props = {
  onClose: () => void;
  initialParts?: CustomEquipmentPart[];
  initialName?: string;
};

export function CustomEquipmentModal({ onClose, initialParts, initialName }: Props) {
  const addCustomType = useCustomEquipmentStore((s) => s.addCustomType);

  const startParts = initialParts?.length ? initialParts : [newPart()];
  const [name, setName] = useState(initialName ?? "Eget redskap");
  const [category, setCategory] = useState<EquipmentCategory>("redskap");
  const [footprintShape, setFootprintShape] = useState<EquipmentShape>("roundedRect");
  const [baseColor, setBaseColor] = useState("#788C9E");
  const [desc, setDesc] = useState("");
  const [partsState, dispatchParts] = useReducer(partsReducer, { parts: startParts, past: [], future: [] });
  const parts = partsState.parts;
  const setParts = useCallback((p: CustomEquipmentPart[]) => dispatchParts({ type: "set", parts: p }), []);
  const [expandedId, setExpandedId] = useState<string | null>(startParts[0]?.id ?? null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(startParts[0]?.id ?? null);

  const orbitRef = useRef<OrbitControlsImpl>(null);

  const dims = calcDimensions(parts);

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
    setParts(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addPart = () => {
    const p = newPart();
    setParts([...parts, p]);
    setExpandedId(p.id);
    setSelectedPartId(p.id);
  };

  const duplicatePart = (id: string) => {
    const src = parts.find((p) => p.id === id);
    if (!src) return;
    const clone: CustomEquipmentPart = { ...src, id: nanoid(6), offsetX: src.offsetX + 0.2, offsetZ: src.offsetZ + 0.2 };
    const idx = parts.findIndex((p) => p.id === id);
    const next = [...parts];
    next.splice(idx + 1, 0, clone);
    setParts(next);
    setExpandedId(clone.id);
    setSelectedPartId(clone.id);
  };

  const removePart = (id: string) => {
    setParts(parts.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
    if (selectedPartId === id) setSelectedPartId(null);
  };

  const handleSelectPart = (id: string) => {
    setSelectedPartId(id);
    setExpandedId(id);
  };

  const handleUpdatePartXZ = useCallback((id: string, offsetX: number, offsetZ: number) => {
    dispatchParts({ type: "set", parts: partsState.parts.map(p => p.id === id ? { ...p, offsetX, offsetZ } : p) });
  }, [partsState.parts]);

  // Ctrl+Z / Ctrl+Y keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatchParts({ type: "undo" }); }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); dispatchParts({ type: "redo" }); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {initialParts ? "Redigera redskap" : "Skapa eget redskap"}
              </p>
              <div className="flex gap-1">
                <button type="button" onClick={() => dispatchParts({ type: "undo" })} disabled={!partsState.past.length}
                  className={"grid h-6 w-6 place-items-center rounded " + (partsState.past.length ? "text-slate-500 hover:bg-surface-2" : "text-slate-300 cursor-not-allowed")}
                  title="Ångra (Ctrl+Z)"><Undo2 size={13} /></button>
                <button type="button" onClick={() => dispatchParts({ type: "redo" })} disabled={!partsState.future.length}
                  className={"grid h-6 w-6 place-items-center rounded " + (partsState.future.length ? "text-slate-500 hover:bg-surface-2" : "text-slate-300 cursor-not-allowed")}
                  title="Gör om (Ctrl+Y)"><Redo2 size={13} /></button>
              </div>
            </div>
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
                    selected={selectedPartId === p.id}
                    onToggle={() => {
                      setExpandedId(expandedId === p.id ? null : p.id);
                      setSelectedPartId(p.id);
                    }}
                    onChange={(patch) => updatePart(p.id, patch)}
                    onDuplicate={() => duplicatePart(p.id)}
                    onDelete={parts.length > 1 ? () => removePart(p.id) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-surface-3 px-4 py-3">
            <p className="mb-1 text-[10px] text-slate-400">
              {dims.widthM.toFixed(2)} × {dims.heightM.toFixed(2)} m · {dims.physicalHeightM.toFixed(2)} m hög
            </p>
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
              Klicka en del för att markera · dra för att flytta i XZ-planet
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
              <PreviewScene
                parts={parts}
                baseColor={baseColor}
                selectedPartId={selectedPartId}
                onSelectPart={handleSelectPart}
                onUpdatePartXZ={handleUpdatePartXZ}
                orbitRef={orbitRef}
              />
              <OrbitControls
                ref={orbitRef}
                target={[0, targetY, 0]}
                autoRotate={selectedPartId === null}
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
  selected,
  onToggle,
  onChange,
  onDuplicate,
  onDelete,
}: {
  part: CustomEquipmentPart;
  index: number;
  baseColor: string;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onChange: (p: Partial<CustomEquipmentPart>) => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}) {
  const showDepth = part.shape === "box" || part.shape === "torus" || part.shape === "wedge";

  return (
    <div
      className={
        "overflow-hidden rounded-lg border bg-surface-2 " +
        (selected ? "border-accent" : "border-surface-3")
      }
    >
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
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          title="Kopiera del"
          className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-blue-100 hover:text-blue-600"
        >
          <Copy size={11} />
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
            <div className="flex flex-wrap gap-1">
              {PART_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ shape: s.id })}
                  className={chip(part.shape === s.id) + " text-[11px]"}
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
                label={
                  part.shape === "cylinder" || part.shape === "sphere" || part.shape === "cone"
                    ? "Diam."
                    : part.shape === "torus" ? "Ring Ø"
                    : "Bredd"  // box, wedge
                }
                value={part.w}
                min={0.05}
                max={10}
                step={0.05}
                onChange={(v) => onChange({ w: v })}
              />
              {part.shape !== "torus" && (
                <NumField
                  label="Höjd"
                  value={part.h}
                  min={0.05}
                  max={10}
                  step={0.05}
                  onChange={(v) => onChange({ h: v })}
                />
              )}
              {showDepth && (
                <NumField
                  label={part.shape === "torus" ? "Rör Ø" : "Djup"}
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
              Position (m) — dra i förhandsgranskning
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
          {part.shape !== "sphere" && (
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
          )}
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
