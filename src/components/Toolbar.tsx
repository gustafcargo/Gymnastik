import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  FolderOpen,
  Grid3x3,
  Image as ImageIcon,
  Maximize2,
  Menu,
  Plus,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { useStore } from "zustand";
import { usePlanStore, useTemporalStore } from "../store/usePlanStore";
import { HALL_TEMPLATES } from "../catalog/halls";
import type Konva from "konva";
import { exportStageAsPng } from "../lib/exportPng";
import { exportStageAsPdf } from "../lib/exportPdf";
import { PlansModal } from "./PlansModal";

type Props = {
  stageRef: React.MutableRefObject<Konva.Stage | null>;
  onToggleSidebar?: () => void;
};

export function Toolbar({ stageRef, onToggleSidebar }: Props) {
  const plan = usePlanStore((s) => s.plan);
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const setHall = usePlanStore((s) => s.setHall);
  const newPlan = usePlanStore((s) => s.newPlan);
  const snapToGrid = usePlanStore((s) => s.snapToGrid);
  const setSnapToGrid = usePlanStore((s) => s.setSnapToGrid);

  // Viktigt: välj primitiva fält var för sig så att Zustand 5 inte
  // kräver egen equality-funktion (annars → "getSnapshot should be cached").
  const undo = useStore(useTemporalStore, (s) => s.undo);
  const redo = useStore(useTemporalStore, (s) => s.redo);
  const pastCount = useStore(useTemporalStore, (s) => s.pastStates.length);
  const futureCount = useStore(
    useTemporalStore,
    (s) => s.futureStates.length,
  );

  const [exportOpen, setExportOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const totalDuration = plan.stations.reduce(
    (acc, s) => acc + s.durationMin,
    0,
  );

  const handleExportPng = () => {
    const stage = stageRef.current;
    if (!stage) return;
    exportStageAsPng(
      stage,
      `${plan.name.replace(/[^\w\-]+/g, "_")}.png`,
    );
    setExportOpen(false);
  };

  const handleExportPdf = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    await exportStageAsPdf(stage, plan);
    setExportOpen(false);
  };

  const totalEquip = plan.stations.reduce(
    (acc, s) => acc + s.equipment.length,
    0,
  );

  return (
    <>
      <div className="safe-top flex items-center gap-2 border-b border-surface-3 bg-white px-3 py-2">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Meny"
            className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-surface-2 lg:hidden"
          >
            <Menu size={18} />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-accent to-purple-500 text-white font-bold shadow-sm">
            G
          </div>
          <input
            type="text"
            value={plan.name}
            onChange={(e) => renamePlan(e.target.value)}
            className="w-40 border-b border-transparent bg-transparent text-sm font-semibold outline-none focus:border-accent sm:w-64"
            aria-label="Passets namn"
          />
        </div>

        <div className="hidden items-center gap-1 md:flex">
          <IconButton
            title="Ångra"
            onClick={() => undo()}
            disabled={pastCount === 0}
          >
            <Undo2 size={16} />
          </IconButton>
          <IconButton
            title="Gör om"
            onClick={() => redo()}
            disabled={futureCount === 0}
          >
            <Redo2 size={16} />
          </IconButton>
          <span className="mx-1 h-6 w-px bg-surface-3" />
          <IconButton
            title={snapToGrid ? "Rutnät: på" : "Rutnät: av"}
            onClick={() => setSnapToGrid(!snapToGrid)}
            active={snapToGrid}
          >
            <Grid3x3 size={16} />
          </IconButton>
          <IconButton
            title="Passa vyn"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("gymnastik:fit-view"))
            }
          >
            <Maximize2 size={16} />
          </IconButton>
        </div>

        <div className="hidden md:block">
          <label className="sr-only" htmlFor="hall-select">
            Hallmall
          </label>
          <select
            id="hall-select"
            value={plan.hall.id}
            onChange={(e) => {
              const h = HALL_TEMPLATES.find((h) => h.id === e.target.value);
              if (h) setHall(h);
            }}
            className="rounded-md border border-surface-3 bg-surface-2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            {HALL_TEMPLATES.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1 text-xs text-slate-500 md:flex">
            <span className="font-medium">{totalEquip}</span> redskap ·{" "}
            <span className="font-medium">{totalDuration}</span> min
          </div>
          <button
            type="button"
            onClick={() => newPlan()}
            className="hidden items-center gap-1.5 rounded-md border border-surface-3 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-2 md:flex"
            title="Skapa nytt pass"
          >
            <Plus size={14} /> Nytt
          </button>
          <button
            type="button"
            onClick={() => setPlansOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-surface-3 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-2"
            title="Mina pass"
          >
            <FolderOpen size={14} />{" "}
            <span className="hidden sm:inline">Mina pass</span>
          </button>
          <div ref={exportRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-ink"
            >
              <Download size={14} />{" "}
              <span className="hidden sm:inline">Exportera</span>
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-surface-3 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <ImageIcon size={16} /> PNG-bild
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <FileText size={16} /> PDF-dokument
                </button>
                <div className="border-t border-surface-3" />
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                  <Save size={13} /> Sparas automatiskt
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {plansOpen && <PlansModal onClose={() => setPlansOpen(false)} />}
    </>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        "grid h-9 w-9 place-items-center rounded-md transition " +
        (disabled
          ? "cursor-not-allowed text-slate-300"
          : active
            ? "bg-accent-soft text-accent-ink"
            : "text-slate-600 hover:bg-surface-2")
      }
    >
      {children}
    </button>
  );
}
