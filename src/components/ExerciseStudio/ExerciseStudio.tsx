/**
 * ExerciseStudio – full-screen overlay för att skapa/redigera övningar.
 *
 * Tre kolumner:
 *   - Vänster: 3D-preview (PosePreview) som visar aktuell pose vid aktuell tid.
 *   - Mitten:  Pose-sliders + metadata-formulär (id, label, apparatus, speed,
 *              advance, range, baseRotY) + knappar (spara, dumpa, spegla,
 *              återställ).
 *   - Höger:   Tidslinje – lista med KFs, play/paus, scrubber.
 *
 * Built-in-övningar kan öppnas, redigeras och sparas → storen lagrar en
 * override med samma id. "Återställ till original" raderar override-posten.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Play, Pause, Plus, Trash2, Copy as CopyIcon,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, RotateCcw,
} from "lucide-react";
import { PosePreview } from "./PosePreview";
import {
  type Pose, type KF, type ExerciseDef, type LockMode,
  ZERO, POSE_KEYS, evalExercise, applyLock,
} from "../../types/pose";
import { BUILT_IN_EXERCISES } from "../Canvas3D/Gymnast3D";
import { useCustomExercisesStore } from "../../store/useCustomExercisesStore";
import { ALL_EXERCISES, type Exercise } from "../../catalog/exercises";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ALL_APPARATUS = [
  "floor", "beam", "high-bar", "uneven-bars", "parallel-bars",
  "rings", "rings-free", "pommel-horse", "vault", "mini-tramp",
  "trampette", "plinth", "buck",
];

// Grupper för slider-UI
const POSE_GROUPS: { label: string; keys: (keyof Pose)[] }[] = [
  { label: "Root",   keys: ["rootX", "rootY", "rootZ", "rootRotX", "rootRotY"] },
  { label: "Spine",  keys: ["spineX", "spineZ"] },
  { label: "Head",   keys: ["headX", "headZ"] },
  { label: "L-arm",  keys: ["lShX", "lShZ", "lElX"] },
  { label: "R-arm",  keys: ["rShX", "rShZ", "rElX"] },
  { label: "L-leg",  keys: ["lHipX", "lHipZ", "lKnX"] },
  { label: "R-leg",  keys: ["rHipX", "rHipZ", "rKnX"] },
];

// Slider-intervall per nyckel (radianer eller meter)
function rangeFor(k: keyof Pose): { min: number; max: number; step: number } {
  if (k.startsWith("root") && !k.startsWith("rootRot"))
    return { min: -3, max: 3, step: 0.01 };
  // Allt annat är radianer – gränsar med 2π ger bra frihet
  return { min: -2 * Math.PI, max: 2 * Math.PI, step: 0.01 };
}

function speglaPose(p: Pose): Pose {
  // Byt L↔R och invertera z-komponenter
  return {
    ...p,
    lShX: p.rShX, rShX: p.lShX,
    lShZ: -p.rShZ, rShZ: -p.lShZ,
    lElX: p.rElX, rElX: p.lElX,
    lHipX: p.rHipX, rHipX: p.lHipX,
    lHipZ: -p.rHipZ, rHipZ: -p.lHipZ,
    lKnX: p.rKnX, rKnX: p.lKnX,
    spineZ: -p.spineZ,
    headZ: -p.headZ,
    rootX: -p.rootX,
  };
}

function cloneDef(def: ExerciseDef): ExerciseDef {
  return {
    kfs: def.kfs.map((k) => ({ t: k.t, pose: { ...k.pose }, locked: k.locked })),
    advance: def.advance,
    range: def.range,
    baseRotY: def.baseRotY,
    lockMode: def.lockMode,
  };
}

const EMPTY_DEF: ExerciseDef = {
  kfs: [{ t: 0, pose: { ...ZERO } }],
};

export function ExerciseStudio({ open, onClose }: Props) {
  const customDefs      = useCustomExercisesStore((s) => s.customDefs);
  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const upsert          = useCustomExercisesStore((s) => s.upsert);
  const overrideBuiltIn = useCustomExercisesStore((s) => s.overrideBuiltIn);
  const revertToBuiltIn = useCustomExercisesStore((s) => s.revertToBuiltIn);
  const remove          = useCustomExercisesStore((s) => s.remove);

  // Vald övning (id + metadata). null = ny tom övning.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<Exercise>({
    id: "", label: "", apparatus: ["floor"], speed: 2.0,
  });
  const [def, setDef] = useState<ExerciseDef>(cloneDef(EMPTY_DEF));
  const [time, setTime] = useState(0);
  const [selectedKfIdx, setSelectedKfIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Laddar vald övning när selectedId ändras
  useEffect(() => {
    if (selectedId === null) {
      setMeta({ id: "", label: "", apparatus: ["floor"], speed: 2.0 });
      setDef(cloneDef(EMPTY_DEF));
      setSelectedKfIdx(0);
      setTime(0);
      return;
    }
    const builtIn = ALL_EXERCISES.find((e) => e.id === selectedId);
    const custom  = customExercises.find((e) => e.id === selectedId);
    const ex = builtIn ?? custom;
    if (ex) setMeta({ ...ex });

    const loadedDef = customDefs[selectedId] ?? BUILT_IN_EXERCISES[selectedId];
    if (loadedDef) setDef(cloneDef(loadedDef));
    setSelectedKfIdx(0);
    setTime(0);
  }, [selectedId, customDefs, customExercises]);

  // lockMode ligger nu direkt på def så den följer med vid spara/läsning.
  const lockMode: LockMode = def.lockMode ?? "none";
  const setLockMode = (m: LockMode) => setDef((d) => ({ ...d, lockMode: m }));

  const duration = def.kfs.length ? def.kfs[def.kfs.length - 1].t : 0;
  // Studion ska inte wrappa tiden (som evalKF gör med `% dur`) – vid t ≥ dur
  // vill vi se sista KF:ns pose. Därför evaluerar vi lokalt med klampad t.
  const currentPose: Pose = useMemo(() => {
    if (def.kfs.length === 0) return ZERO;
    if (def.kfs.length === 1) return def.kfs[0].pose;
    if (time >= duration) return def.kfs[def.kfs.length - 1].pose;
    return evalExercise(def, Math.max(0, time));
  }, [def, time, duration]);

  // Om selectedKfIdx hamnat utanför listan (t.ex. vid laddning av en kortare
  // övning) – klämp in det igen så slidrarna redigerar en giltig KF.
  useEffect(() => {
    if (selectedKfIdx >= def.kfs.length) {
      setSelectedKfIdx(Math.max(0, def.kfs.length - 1));
    }
  }, [def.kfs.length, selectedKfIdx]);

  // Klampa scrubber-tiden när duration krymper (t.ex. efter delete av sista KF),
  // annars fastnar slidern visuellt i slutet och evalKF wrap:ar till första KF.
  useEffect(() => {
    if (time > duration) setTime(duration);
  }, [duration, time]);

  // Play-loop
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  useEffect(() => {
    if (!playing || duration === 0) return;
    const loop = (ts: number) => {
      if (lastTsRef.current === 0) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((t) => (t + dt) % duration);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
  }, [playing, duration]);

  const isBuiltIn   = meta.id !== "" && ALL_EXERCISES.some((e) => e.id === meta.id);
  const hasOverride = isBuiltIn && customDefs[meta.id] !== undefined;

  // ── Handlers ─────────────────────────────────────────────────────────────
  // Viktigt: KF-listan sorteras efter t vid varje ändring, och rader kan
  // tas bort – så ett statiskt index till `selectedKfIdx` skulle ofta peka
  // på fel KF. Därför återräknar vi indexet via objekt-identitet efter
  // varje mutation (referensen till det muterade KF-objektet bevaras).
  const updateKeyframe = (idx: number, patch: Partial<KF>) => {
    const target = def.kfs[idx];
    if (!target) return;
    const updated: KF = { ...target, ...patch };
    const newKfs = def.kfs
      .map((k, i) => (i === idx ? updated : k))
      .sort((a, b) => a.t - b.t);
    setDef((d) => ({ ...d, kfs: newKfs }));
    if (selectedKfIdx === idx) {
      const newIdx = newKfs.indexOf(updated);
      if (newIdx !== -1) setSelectedKfIdx(newIdx);
    }
  };

  const updatePoseKey = (key: keyof Pose, value: number) => {
    setDef((d) => ({
      ...d,
      kfs: d.kfs.map((k, i) => {
        if (i !== selectedKfIdx) return k;
        const next: Pose = { ...k.pose, [key]: value };
        // Vid hand/fot-lås: när en vinkel som ingår i lås-formeln ändras
        // (rootRotX alltid; spineX också när händerna är låsta eftersom bålen
        // roterar body-up-riktningen) så räknar vi automatiskt om rootY/rootZ
        // så pivot-punkten följer rotationen. Offsetet (skillnaden mellan
        // pose.rootY/Z och rena låsvärdet) bevaras. Hoppa över KFs där
        // locked === false (släpp-moment – pose är i fritt flyg).
        const affectsLock =
          key === "rootRotX" ||
          (lockMode === "hands" && key === "spineX");
        if (lockMode !== "none" && affectsLock && k.locked !== false) {
          const oldLocked = applyLock(k.pose, lockMode);
          const offsetY = k.pose.rootY - oldLocked.rootY;
          const offsetZ = k.pose.rootZ - oldLocked.rootZ;
          const newLocked = applyLock(next, lockMode);
          return {
            ...k,
            pose: { ...newLocked, rootY: newLocked.rootY + offsetY, rootZ: newLocked.rootZ + offsetZ },
          };
        }
        return { ...k, pose: next };
      }),
    }));
  };

  const toggleKfLock = (idx: number) => {
    setDef((d) => ({
      ...d,
      kfs: d.kfs.map((k, i) =>
        i === idx ? { ...k, locked: k.locked === false ? true : false } : k,
      ),
    }));
  };

  // Sparad def (override eller built-in) – källa för per-slider reset.
  // null innebär att KF:en inte har ett sparat värde → reset faller
  // tillbaka på ZERO[key].
  const savedDef: ExerciseDef | null = selectedId
    ? customDefs[selectedId] ?? BUILT_IN_EXERCISES[selectedId] ?? null
    : null;

  const resetPoseKey = (key: keyof Pose) => {
    const savedKf = savedDef?.kfs[selectedKfIdx];
    const value = savedKf ? savedKf.pose[key] : ZERO[key];
    updatePoseKey(key, value);
  };

  const addKeyframe = () => {
    const lastT = def.kfs.length ? def.kfs[def.kfs.length - 1].t : 0;
    const newKf: KF = { t: lastT + 0.5, pose: { ...currentPose } };
    const newKfs = [...def.kfs, newKf].sort((a, b) => a.t - b.t);
    setDef((d) => ({ ...d, kfs: newKfs }));
    setSelectedKfIdx(newKfs.indexOf(newKf));
    setTime(newKf.t);
  };

  const duplicateKeyframe = (idx: number) => {
    const src = def.kfs[idx];
    if (!src) return;
    // Lägg dubbletten direkt efter källan: mitt emellan src och nästa KF
    // (eller src.t + 0.25 om src är sist). Så den hamnar som nästa frame
    // i listan, inte längst ner.
    const next = def.kfs[idx + 1];
    const newT = next ? (src.t + next.t) / 2 : src.t + 0.25;
    const newKf: KF = { t: newT, pose: { ...src.pose } };
    const newKfs = [...def.kfs, newKf].sort((a, b) => a.t - b.t);
    setDef((d) => ({ ...d, kfs: newKfs }));
    setSelectedKfIdx(newKfs.indexOf(newKf));
    setTime(newKf.t);
    setPlaying(false);
  };

  const deleteKeyframe = (idx: number) => {
    if (def.kfs.length <= 1) return;
    const newKfs = def.kfs.filter((_, i) => i !== idx);
    setDef((d) => ({ ...d, kfs: newKfs }));
    setSelectedKfIdx((cur) => {
      if (idx < cur) return cur - 1;
      if (idx === cur) return Math.min(cur, newKfs.length - 1);
      return cur;
    });
  };

  const stepKeyframe = (delta: -1 | 1) => {
    if (def.kfs.length === 0) return;
    const next = Math.max(0, Math.min(def.kfs.length - 1, selectedKfIdx + delta));
    setSelectedKfIdx(next);
    setTime(def.kfs[next].t);
    setPlaying(false);
  };

  // Ordna om KF: byt t med grannen så sorteringen flippar ordningen.
  const moveKeyframe = (idx: number, delta: -1 | 1) => {
    const neighbor = idx + delta;
    if (neighbor < 0 || neighbor >= def.kfs.length) return;
    const a = def.kfs[idx];
    const b = def.kfs[neighbor];
    const swapped: KF[] = def.kfs.map((k) => {
      if (k === a) return { ...a, t: b.t };
      if (k === b) return { ...b, t: a.t };
      return k;
    });
    swapped.sort((x, y) => x.t - y.t);
    setDef((d) => ({ ...d, kfs: swapped }));
    if (selectedKfIdx === idx) setSelectedKfIdx(neighbor);
    else if (selectedKfIdx === neighbor) setSelectedKfIdx(idx);
  };

  const mirrorCurrentPose = () => {
    setDef((d) => ({
      ...d,
      kfs: d.kfs.map((k, i) =>
        i === selectedKfIdx ? { ...k, pose: speglaPose(k.pose) } : k,
      ),
    }));
  };

  const resetCurrentPose = () => {
    setDef((d) => ({
      ...d,
      kfs: d.kfs.map((k, i) =>
        i === selectedKfIdx ? { ...k, pose: { ...ZERO } } : k,
      ),
    }));
  };

  const save = () => {
    if (!meta.id.trim()) {
      alert("Ange ett id innan du sparar.");
      return;
    }
    if (isBuiltIn) {
      overrideBuiltIn(meta.id, def);
    } else {
      upsert(meta, def);
    }
  };

  const handleRevert = () => {
    if (hasOverride) {
      revertToBuiltIn(meta.id);
      // Ladda om från built-in
      setDef(cloneDef(BUILT_IN_EXERCISES[meta.id]!));
    }
  };

  const handleDelete = () => {
    if (isBuiltIn) {
      handleRevert();
    } else if (meta.id && customDefs[meta.id]) {
      remove(meta.id);
      setSelectedId(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Acceptera både { meta, def } (vår export) och en naken ExerciseDef.
      const incomingDef: ExerciseDef | undefined = parsed?.def ?? (parsed?.kfs ? parsed : undefined);
      const incomingMeta: Exercise | undefined = parsed?.meta;
      if (!incomingDef || !Array.isArray(incomingDef.kfs)) {
        alert("Filen ser inte ut att vara en giltig övning (kfs saknas).");
        return;
      }
      setDef(cloneDef(incomingDef));
      if (incomingMeta && typeof incomingMeta.id === "string") {
        setMeta({
          id: incomingMeta.id,
          label: incomingMeta.label ?? "",
          apparatus: Array.isArray(incomingMeta.apparatus) ? incomingMeta.apparatus : ["floor"],
          speed: typeof incomingMeta.speed === "number" ? incomingMeta.speed : 2.0,
        });
      }
      setSelectedId(null); // låt användaren spara själv
      setSelectedKfIdx(0);
      setTime(0);
      setPlaying(false);
    } catch (err) {
      alert(`Kunde inte läsa filen: ${(err as Error).message}`);
    }
  };

  const dumpJson = () => {
    // Exportera övningen som .json-fil till användarens dator via en
    // tillfällig <a download>. Samma mönster som klassisk "save file"-flöde
    // i SPA:n; fungerar offline och kräver ingen backend.
    const safeId = (meta.id || "exercise").replace(/[^a-z0-9_.-]+/gi, "_");
    const blob = new Blob([JSON.stringify({ meta, def }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  // Lista alla tillgängliga övningar i dropdown
  const allOptions: { id: string; label: string; isBuiltIn: boolean; hasOverride: boolean }[] = [
    ...ALL_EXERCISES.map((e) => ({
      id: e.id, label: e.label, isBuiltIn: true,
      hasOverride: customDefs[e.id] !== undefined,
    })),
    ...customExercises
      .filter((e) => !ALL_EXERCISES.some((b) => b.id === e.id))
      .map((e) => ({ id: e.id, label: e.label, isBuiltIn: false, hasOverride: false })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 text-slate-100 backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-800 px-4 py-2">
        <strong className="mr-4 text-base font-semibold">Övningsstudio</strong>

        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="rounded bg-slate-700 px-2 py-1 text-sm"
        >
          <option value="">— Ny övning —</option>
          {allOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.id}) {o.hasOverride ? " •redigerad" : ""} {!o.isBuiltIn ? " •custom" : ""}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={save}
          className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold hover:bg-emerald-500"
        >
          Spara
        </button>
        {hasOverride && (
          <button
            type="button"
            onClick={handleRevert}
            className="rounded bg-amber-600 px-3 py-1 text-sm hover:bg-amber-500"
          >
            Återställ till original
          </button>
        )}
        {!isBuiltIn && meta.id && customDefs[meta.id] && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded bg-rose-600 px-3 py-1 text-sm hover:bg-rose-500"
          >
            Radera övning
          </button>
        )}
        <button
          type="button"
          onClick={dumpJson}
          className="rounded bg-slate-600 px-3 py-1 text-sm hover:bg-slate-500"
          title="Ladda ner övningen som .json-fil"
        >
          Exportera JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded bg-slate-600 px-3 py-1 text-sm hover:bg-slate-500"
          title="Läs in en övning från en .json-fil"
        >
          Importera JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = ""; // gör att samma fil kan väljas igen
          }}
        />

        <div className="flex-1" />

        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded hover:bg-slate-700"
          aria-label="Stäng"
        >
          <X size={18} />
        </button>
      </div>

      {/* Metadata row */}
      <div className="grid grid-cols-6 gap-2 border-b border-slate-700 bg-slate-800/60 px-4 py-2 text-xs">
        <label className="col-span-1">
          Id
          <input
            type="text"
            value={meta.id}
            disabled={isBuiltIn}
            onChange={(e) => setMeta((m) => ({ ...m, id: e.target.value }))}
            className="mt-0.5 w-full rounded bg-slate-700 px-2 py-1 disabled:opacity-60"
          />
        </label>
        <label className="col-span-1">
          Label
          <input
            type="text"
            value={meta.label}
            onChange={(e) => setMeta((m) => ({ ...m, label: e.target.value }))}
            className="mt-0.5 w-full rounded bg-slate-700 px-2 py-1"
          />
        </label>
        <label className="col-span-2">
          Apparatus
          <select
            multiple
            value={meta.apparatus}
            onChange={(e) =>
              setMeta((m) => ({
                ...m,
                apparatus: Array.from(e.target.selectedOptions, (o) => o.value),
              }))
            }
            className="mt-0.5 h-16 w-full rounded bg-slate-700 px-2 py-1"
          >
            {ALL_APPARATUS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="col-span-1">
          Speed
          <input
            type="number"
            step={0.1}
            value={meta.speed}
            onChange={(e) => setMeta((m) => ({ ...m, speed: parseFloat(e.target.value) || 0 }))}
            className="mt-0.5 w-full rounded bg-slate-700 px-2 py-1"
          />
        </label>
        <div className="col-span-1 flex flex-col gap-1">
          <label className="flex items-center gap-2">
            <span className="w-16">advance</span>
            <input
              type="number"
              step={0.05}
              value={def.advance ?? 0}
              onChange={(e) =>
                setDef((d) => ({ ...d, advance: parseFloat(e.target.value) || 0 }))
              }
              className="w-full rounded bg-slate-700 px-2 py-0.5"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16">range</span>
            <input
              type="number"
              step={0.1}
              value={def.range ?? 0}
              onChange={(e) =>
                setDef((d) => ({ ...d, range: parseFloat(e.target.value) || 0 }))
              }
              className="w-full rounded bg-slate-700 px-2 py-0.5"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16">baseRotY</span>
            <input
              type="number"
              step={0.05}
              value={def.baseRotY ?? 0}
              onChange={(e) =>
                setDef((d) => ({ ...d, baseRotY: parseFloat(e.target.value) || 0 }))
              }
              className="w-full rounded bg-slate-700 px-2 py-0.5"
            />
          </label>
        </div>
      </div>

      {/* Main grid: preview | sliders | timeline */}
      <div className="grid flex-1 grid-cols-[1fr_360px_320px] overflow-hidden">
        {/* Preview */}
        <div className="relative">
          <PosePreview pose={currentPose} def={def} apparatus={meta.apparatus[0]} />
          {/* Scrubber overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-slate-900/80 px-3 py-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="grid h-8 w-8 place-items-center rounded bg-slate-700 hover:bg-slate-600"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.01}
              value={time}
              onChange={(e) => { setPlaying(false); setTime(parseFloat(e.target.value)); }}
              className="flex-1"
            />
            <span className="w-20 text-right font-mono text-xs text-slate-300">
              {time.toFixed(2)} / {duration.toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Sliders */}
        <div className="overflow-y-auto border-l border-slate-700 bg-slate-800/60 px-3 py-2">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={mirrorCurrentPose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              Spegla L↔R
            </button>
            <button
              type="button"
              onClick={resetCurrentPose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              Nolla pose
            </button>
          </div>

          <div className="mb-3 rounded border border-slate-700 bg-slate-800/60 p-2">
            <div className="mb-1 text-[11px] font-semibold text-slate-300">
              Lås pivot (rootY/rootZ följer rootRotX)
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(["none", "hands", "feet"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLockMode(m)}
                  className={`rounded px-2 py-1 text-[11px] ${
                    lockMode === m
                      ? "bg-accent text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {m === "none" ? "Inget" : m === "hands" ? "Händer (räcke)" : "Fötter (golv)"}
                </button>
              ))}
            </div>
          </div>

          {POSE_GROUPS.map((g) => (
            <details key={g.label} open={g.label === "Root" || g.label === "Spine"} className="mb-1">
              <summary className="cursor-pointer rounded bg-slate-700/40 px-2 py-1 text-xs font-semibold">
                {g.label}
              </summary>
              <div className="space-y-1 px-2 py-2">
                {g.keys.map((k) => {
                  const r = rangeFor(k);
                  const v = currentPose[k];
                  // rootY/rootZ låses av pivot-låset om den valda KF:en är låst
                  const selKf = def.kfs[selectedKfIdx];
                  const kfLocked = selKf?.locked !== false;
                  const locked = lockMode !== "none" && kfLocked && (k === "rootY" || k === "rootZ");
                  const savedVal = savedDef?.kfs[selectedKfIdx]?.pose[k] ?? ZERO[k];
                  const canReset = !locked && Math.abs(v - savedVal) > 1e-6;
                  return (
                    <label key={k} className={`flex items-center gap-1.5 text-[11px] ${locked ? "opacity-50" : ""}`}>
                      <span className="w-16 font-mono text-slate-300" title={locked ? "Låst – följer rootRotX" : undefined}>
                        {k}{locked ? " 🔒" : ""}
                      </span>
                      <input
                        type="range"
                        min={r.min}
                        max={r.max}
                        step={r.step}
                        value={v}
                        disabled={locked}
                        onChange={(e) => updatePoseKey(k, parseFloat(e.target.value))}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        step={r.step}
                        value={Number(v.toFixed(3))}
                        disabled={locked}
                        onChange={(e) => updatePoseKey(k, parseFloat(e.target.value) || 0)}
                        className="w-16 rounded bg-slate-700 px-1 py-0.5 font-mono disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => resetPoseKey(k)}
                        disabled={locked || !canReset}
                        className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-600 hover:text-slate-100 disabled:opacity-20"
                        title={`Återställ till sparat värde (${savedVal.toFixed(3)})`}
                        aria-label="Återställ"
                      >
                        <RotateCcw size={11} />
                      </button>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}

          <details className="mt-2">
            <summary className="cursor-pointer rounded bg-slate-700/40 px-2 py-1 text-xs">
              Alla 19 DOF (rå)
            </summary>
            <div className="space-y-1 px-2 py-2">
              {POSE_KEYS.map((k) => (
                <div key={k} className="flex justify-between font-mono text-[10px] text-slate-400">
                  <span>{k}</span>
                  <span>{currentPose[k].toFixed(3)}</span>
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Timeline */}
        <div className="flex flex-col overflow-hidden border-l border-slate-700 bg-slate-800/60">
          <div className="flex items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
            <strong className="text-sm">Keyframes ({def.kfs.length})</strong>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => stepKeyframe(-1)}
                disabled={selectedKfIdx <= 0}
                className="grid h-7 w-7 place-items-center rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                aria-label="Föregående keyframe"
                title="Föregående keyframe"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => stepKeyframe(1)}
                disabled={selectedKfIdx >= def.kfs.length - 1}
                className="grid h-7 w-7 place-items-center rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                aria-label="Nästa keyframe"
                title="Nästa keyframe"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={addKeyframe}
                className="flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
              >
                <Plus size={12} /> Lägg till
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {def.kfs.map((k, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 border-b border-slate-700/60 px-2 py-1.5 text-xs ${
                  selectedKfIdx === i ? "bg-slate-700/60" : "hover:bg-slate-700/30"
                }`}
              >
                <button
                  type="button"
                  onClick={() => { setSelectedKfIdx(i); setTime(k.t); setPlaying(false); }}
                  className="flex-1 text-left"
                >
                  <span className="font-mono text-slate-300">#{i}</span>{" "}
                  <span className="font-mono text-slate-400">t=</span>
                </button>
                <input
                  type="number"
                  step={0.05}
                  value={k.t}
                  onChange={(e) => updateKeyframe(i, { t: parseFloat(e.target.value) || 0 })}
                  className="w-14 rounded bg-slate-700 px-1 py-0.5 font-mono"
                />
                {lockMode !== "none" && (
                  <button
                    type="button"
                    onClick={() => toggleKfLock(i)}
                    className={`grid h-6 w-6 place-items-center rounded text-xs ${
                      k.locked === false
                        ? "text-slate-500 hover:bg-slate-600"
                        : "text-accent hover:bg-slate-600"
                    }`}
                    title={k.locked === false ? "Släppt (fritt) – klicka för att låsa" : "Låst till pivot – klicka för att släppa"}
                    aria-label={k.locked === false ? "Lås KF" : "Släpp KF"}
                  >
                    {k.locked === false ? "🔓" : "🔒"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => moveKeyframe(i, -1)}
                  disabled={i === 0}
                  className="grid h-6 w-6 place-items-center rounded hover:bg-slate-600 disabled:opacity-30"
                  aria-label="Flytta upp"
                  title="Flytta upp"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveKeyframe(i, 1)}
                  disabled={i === def.kfs.length - 1}
                  className="grid h-6 w-6 place-items-center rounded hover:bg-slate-600 disabled:opacity-30"
                  aria-label="Flytta ner"
                  title="Flytta ner"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateKeyframe(i)}
                  className="grid h-6 w-6 place-items-center rounded hover:bg-slate-600"
                  aria-label="Duplicera"
                >
                  <CopyIcon size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteKeyframe(i)}
                  disabled={def.kfs.length <= 1}
                  className="grid h-6 w-6 place-items-center rounded hover:bg-rose-900/40 disabled:opacity-30"
                  aria-label="Radera"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-700 bg-slate-900/60 p-2 text-[10px] text-slate-400">
            Klicka på en KF för att välja och hoppa i tid. Pose-slidrarna
            redigerar aktuell KF. "Spara" skriver till storen (built-in blir
            override med samma id).
          </div>
        </div>
      </div>
    </div>
  );
}
