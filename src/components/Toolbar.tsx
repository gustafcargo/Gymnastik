import { useEffect, useRef, useState } from "react";
import {
  Box,
  Download,
  FileText,
  FolderOpen,
  Gamepad2,
  Grid3x3,
  Image as ImageIcon,
  Maximize2,
  Menu,
  Pencil,
  Plus,
  Redo2,
  Save,
  Sliders,
  Square,
  MessageSquare,
  Tag,
  Undo2,
} from "lucide-react";
import { useStore } from "zustand";
import { usePlanStore, useTemporalStore } from "../store/usePlanStore";
import { useStudioStore } from "../store/useStudioStore";
import { HALL_TEMPLATES } from "../catalog/halls";
import type Konva from "konva";
import { exportStageAsPng } from "../lib/exportPng";
import { exportStageAsPdf } from "../lib/exportPdf";
import { PlansModal } from "./PlansModal";
import { UserMenu } from "./Account/UserMenu";
import { ClubPicker } from "./Account/ClubPicker";
import { MobileDrawer } from "./MobileDrawer";

type Props = {
  stageRef: React.MutableRefObject<Konva.Stage | null>;
  onToggleSidebar?: () => void;
};

export function Toolbar({ stageRef, onToggleSidebar }: Props) {
  const plan = usePlanStore((s) => s.plan);
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const setHall = usePlanStore((s) => s.setHall);
  const newPlan = usePlanStore((s) => s.newPlan);
  const savePlan = usePlanStore((s) => s.savePlan);
  const isDirty = usePlanStore((s) => s.isDirty);
  const selectEquipment = usePlanStore((s) => s.selectEquipment);
  const snapToGrid = usePlanStore((s) => s.snapToGrid);
  const setSnapToGrid = usePlanStore((s) => s.setSnapToGrid);
  const viewMode = usePlanStore((s) => s.viewMode);
  const toggleViewMode = usePlanStore((s) => s.toggleViewMode);
  const gameMode = usePlanStore((s) => s.gameMode);
  const toggleGameMode = usePlanStore((s) => s.toggleGameMode);
  const showLabels = usePlanStore((s) => s.showLabels);
  const toggleLabels = usePlanStore((s) => s.toggleLabels);
  const showNotes = usePlanStore((s) => s.showNotes);
  const toggleNotes = usePlanStore((s) => s.toggleNotes);
  const toggleStudio = useStudioStore((s) => s.toggle);

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
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Ctrl/Cmd+S sparar passet explicit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        savePlan();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [savePlan]);

  const totalDuration = plan.stations.reduce(
    (acc, s) => acc + s.durationMin,
    0,
  );

  /**
   * Kör ett export-jobb utan att markeringen syns i bilden. Markeringen
   * avmarkeras innan stage ritas till PNG och återställs direkt efteråt
   * så användarens markering behålls i editorn.
   */
  const withClearedSelection = async (job: () => Promise<void>) => {
    const prevSelected = usePlanStore.getState().selectedEquipmentId;
    if (prevSelected) selectEquipment(null);
    // Konva ritar asynkront – vänta en frame så Transformer-boxar försvinner
    // innan vi snapshottar canvas.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      await job();
    } finally {
      if (prevSelected) selectEquipment(prevSelected);
    }
  };

  const handleExportPng = async () => {
    setExportOpen(false);
    if (viewMode === "3D") {
      window.dispatchEvent(new CustomEvent("gymnastik:export-3d-png"));
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    await withClearedSelection(async () => {
      await exportStageAsPng(
        stage,
        plan,
        `${plan.name.replace(/[^\w\-]+/g, "_")}.png`,
      );
    });
  };

  const handleExportPdf = async () => {
    setExportOpen(false);
    if (viewMode === "3D") {
      window.dispatchEvent(new CustomEvent("gymnastik:export-3d-pdf"));
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    await withClearedSelection(async () => {
      await exportStageAsPdf(stage, plan);
    });
  };

  const totalEquip = plan.stations.reduce(
    (acc, s) => acc + s.equipment.length,
    0,
  );

  return (
    <>
      <div className="safe-top safe-x relative z-20 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-surface-3 bg-white px-3 py-2">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Öppna meny"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-surface-2 md:hidden"
        >
          <Menu size={18} />
        </button>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Meny"
            className="hidden h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-surface-2 md:grid"
          >
            <Menu size={18} />
          </button>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-accent to-purple-500 text-white font-bold shadow-sm">
            G
          </div>
          <label className="group flex min-w-0 flex-1 items-center gap-1 rounded-md border border-surface-3 bg-surface-2/60 px-2 py-1 focus-within:border-accent focus-within:bg-white sm:w-48">
            <Pencil size={12} className="shrink-0 text-slate-400 group-focus-within:text-accent" />
            <input
              type="text"
              value={plan.name}
              onChange={(e) => renamePlan(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
              placeholder="Namn på passet"
              aria-label="Passets namn"
            />
          </label>
          <button
            type="button"
            onClick={() => savePlan()}
            disabled={!isDirty}
            title={isDirty ? "Spara passet" : "Passet är sparat"}
            aria-label={isDirty ? "Spara passet" : "Passet är sparat"}
            className={
              "flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition " +
              (isDirty
                ? "bg-accent text-white shadow-sm hover:bg-accent-ink active:opacity-80"
                : "cursor-default bg-surface-2 text-slate-400")
            }
          >
            <Save size={13} />
            <span className="hidden sm:inline">
              {isDirty ? "Spara" : "Sparat"}
            </span>
          </button>
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
            title={showLabels ? "Etiketter: på" : "Etiketter: av"}
            onClick={toggleLabels}
            active={showLabels}
          >
            <Tag size={16} />
          </IconButton>
          <IconButton
            title={showNotes ? "Anteckningar: på" : "Anteckningar: av"}
            onClick={toggleNotes}
            active={showNotes}
          >
            <MessageSquare size={16} />
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

        {/* Vy-toggle: göms på mobil (flyttas in i drawer). */}
        <button
          type="button"
          onClick={toggleViewMode}
          className={
            "hidden h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold transition md:flex " +
            (viewMode === "3D"
              ? "bg-accent text-white shadow-sm"
              : "bg-surface-2 text-slate-700 hover:bg-surface-3")
          }
          title={viewMode === "3D" ? "Visa 2D-vy" : "Visa 3D-vy"}
          aria-label={`V\u00e4xla till ${viewMode === "3D" ? "2D" : "3D"}-vy`}
        >
          {viewMode === "3D" ? <Box size={14} /> : <Square size={14} />}
          <span>{viewMode}</span>
        </button>

        <button
          type="button"
          onClick={toggleStudio}
          className="hidden h-9 items-center gap-1 rounded-md bg-surface-2 px-2 text-xs font-semibold text-slate-700 transition hover:bg-surface-3 md:flex"
          title="Öppna Övningsstudio"
          aria-label="Öppna Övningsstudio"
        >
          <Sliders size={14} />
          <span className="hidden sm:inline">Studio</span>
        </button>

        <ClubPicker />
        <UserMenu />

        {viewMode === "3D" && (
          <button
            type="button"
            onClick={toggleGameMode}
            className={
              "hidden h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold transition md:flex " +
              (gameMode
                ? "bg-green-600 text-white shadow-sm"
                : "bg-surface-2 text-slate-700 hover:bg-surface-3")
            }
            title={gameMode ? "Avsluta spelläge" : "Spelläge – styr gymnasten"}
          >
            <Gamepad2 size={14} />
            <span className="hidden sm:inline">Spelläge</span>
          </button>
        )}

        <div className="relative z-10 hidden shrink-0 md:block">
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
            className="h-9 min-w-[110px] max-w-[160px] truncate rounded-md border border-surface-3 bg-surface-2 px-2 text-xs font-medium outline-none focus:border-accent sm:text-sm"
            title={plan.hall.name}
          >
            {HALL_TEMPLATES.map((h) => (
              <option key={h.id} value={h.id}>
                {`${h.widthM} × ${h.heightM} m`}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
            className="hidden items-center gap-1.5 rounded-md border border-surface-3 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-2 active:bg-surface-3 md:flex"
            title="Mina pass"
          >
            <FolderOpen size={14} />{" "}
            <span className="hidden sm:inline">Mina pass</span>
          </button>
          <div ref={exportRef} className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-ink active:opacity-80"
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
              </div>
            )}
          </div>
        </div>
      </div>
      {plansOpen && <PlansModal onClose={() => setPlansOpen(false)} />}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenPlans={() => setPlansOpen(true)}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
      />
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
