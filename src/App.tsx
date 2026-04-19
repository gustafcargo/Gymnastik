import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type Konva from "konva";
import { Plus, Settings2, X } from "lucide-react";
import { Toolbar } from "./components/Toolbar";
import { EquipmentPalette } from "./components/Sidebar/EquipmentPalette";
import { PropertyPanel } from "./components/Sidebar/PropertyPanel";
import { HallStage } from "./components/Canvas/HallStage";
import { CommandPalette } from "./components/CommandPalette";
import { BottomSheet } from "./components/Mobile/BottomSheet";
import { EquipmentEditor } from "./components/EquipmentEditor/EquipmentEditor";
import { GymnastTuningPanel } from "./components/GymnastTuningPanel";
import { ExerciseStudio } from "./components/ExerciseStudio/ExerciseStudio";
import { AccountPanel } from "./components/Account/AccountPanel";
import { GymnastStylePanel } from "./components/Canvas3D/GymnastStylePanel";
import { useStudioStore } from "./store/useStudioStore";
import { useMultiplayerStore } from "./store/useMultiplayerStore";
import { isMultiplayerEnabled } from "./lib/multiplayer";
import { useProfileSync } from "./lib/useProfileSync";
import { useFriendsSync } from "./lib/useFriendsSync";
import { usePlanCloudSync } from "./lib/usePlanCloudSync";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePlanStore } from "./store/usePlanStore";
import { getEquipmentById } from "./catalog/equipment";

// Lazy-loada 3D-vyn så three.js inte hamnar i initial-bundle
const Hall3D = lazy(() =>
  import("./components/Canvas3D/Hall3D").then((m) => ({ default: m.Hall3D })),
);

/** Fångar krascher i 3D-vyn. Visar ett synligt fel + retry-knapp istället
 *  för att tyst tömma skärmen. Tidigare bouncades användaren tillbaka till
 *  2D-editorn, vilket på iPad Air gav intryck av att "spelläget inte öppnar".
 *  Nu ser spelaren vad som hände och kan trycka Försök igen. */
class ThreeDErrorBoundary extends Component<
  { children: ReactNode; is3D: boolean },
  { crashed: boolean; message: string | null; stackTop: string | null }
> {
  state = { crashed: false, message: null as string | null, stackTop: null as string | null };

  // Nollställ felet automatiskt när användaren växlar bort från 3D och
  // tillbaka — annars skulle ett gammalt fel ligga kvar efter att vi
  // sett error-UI:t och gått till 2D och tillbaka via toolbaren.
  static getDerivedStateFromProps(
    props: { is3D: boolean },
    state: { crashed: boolean; message: string | null; stackTop: string | null },
  ) {
    if (!props.is3D && state.crashed) return { crashed: false, message: null, stackTop: null };
    return null;
  }

  static getDerivedStateFromError(err: Error) {
    const stack = err.stack ?? "";
    // Plocka första "intressanta" raden ur stacken — hoppa över själva
    // Error-raden så vi får var det smällde.
    const top = stack.split("\n").slice(1).find((l) => l.trim().length > 0)?.trim() ?? null;
    return { crashed: true, message: err.message || String(err), stackTop: top };
  }
  componentDidCatch(err: Error) {
    console.warn("[3D] krasch:", err);
    // Logga en full stack i DOM-attribut så kan läsas via Safari Web Inspector
    // även när konsolen är svår att nå på iPad.
    try {
      document.documentElement.setAttribute("data-3d-error", err.stack?.slice(0, 500) ?? err.message);
    } catch { /* ignoreras */ }
  }
  private retry = () => {
    this.setState({ crashed: false, message: null, stackTop: null });
  };
  private exitToEditor = () => {
    usePlanStore.getState().setViewMode("2D");
    if (usePlanStore.getState().gameMode) {
      usePlanStore.getState().setGameMode(false);
    }
    this.setState({ crashed: false, message: null, stackTop: null });
  };
  private hardReload = () => {
    // Tvinga omladdning av bundle + SW cache. Hjälper när iPad ligger
    // kvar på en äldre chunk efter att appen har uppdaterats.
    try {
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    } catch { /* ignoreras */ }
    window.location.reload();
  };
  render() {
    if (this.state.crashed) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-900/95 p-6 text-center text-slate-100"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <div className="text-lg font-semibold">3D-vyn kraschade</div>
          <div className="max-w-md text-xs text-slate-400">
            {this.state.message ?? "Okänt fel"}
          </div>
          {this.state.stackTop && (
            <div className="max-w-md break-all font-mono text-[10px] text-slate-500">
              {this.state.stackTop}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow active:opacity-80"
            >
              Försök igen
            </button>
            <button
              type="button"
              onClick={this.exitToEditor}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 active:opacity-80"
            >
              Tillbaka till 2D
            </button>
            <button
              type="button"
              onClick={this.hardReload}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 active:opacity-80"
            >
              Ladda om
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  useKeyboardShortcuts();
  useProfileSync();
  useFriendsSync();
  usePlanCloudSync();
  const stageRef = useRef<Konva.Stage | null>(null);

  // Three layout tiers:
  //   desktop  – mouse device ≥1024px  → always-visible sidebars
  //   tablet   – touch device ≥768px   → slide-in overlay panels (iPad)
  //   mobile   – anything <768px       → FAB + bottom sheets
  const isDesktop = useMediaQuery(
    "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
  );
  const isLargeScreen = useMediaQuery("(min-width: 768px)");
  const isTablet = isLargeScreen && !isDesktop;
  const isMobile = !isLargeScreen;

  const selectedId = usePlanStore((s) => s.selectedEquipmentId);
  const viewMode = usePlanStore((s) => s.viewMode);
  const gameMode = usePlanStore((s) => s.gameMode);
  const is3D = viewMode === "3D";

  const studioOpen = useStudioStore((s) => s.open);
  const setStudioOpen = useStudioStore((s) => s.setOpen);
  const appearanceOpen = useStudioStore((s) => s.appearanceOpen);
  const setAppearanceOpen = useStudioStore((s) => s.setAppearanceOpen);

  const plan = usePlanStore((s) => s.plan);
  const selectedEq = selectedId
    ? plan.stations
        .find((s) => s.id === plan.activeStationId)
        ?.equipment.find((e) => e.id === selectedId)
    : null;
  const selectedType = selectedEq ? getEquipmentById(selectedEq.typeId) : null;
  const selectedLabel = selectedEq?.label ?? selectedType?.name ?? "";

  const handleStageReady = useCallback(
    (s: Konva.Stage) => { stageRef.current = s; },
    [],
  );

  const [has3DLoaded, setHas3DLoaded] = useState(
    () => usePlanStore.getState().viewMode === "3D",
  );
  useEffect(() => {
    if (is3D) setHas3DLoaded(true);
  }, [is3D]);

  // Autojoin multiplayer-rum från URL-parametern ?room=CODE.
  // Spelläget aktiveras redan synkront i usePlanStore-init (läser URL
  // direkt), så här behöver vi bara trigga själva Supabase-anslutningen.
  useEffect(() => {
    if (!isMultiplayerEnabled) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    if (!code) return;
    void useMultiplayerStore.getState().join(code);
  }, []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const selectEquipment = usePlanStore((s) => s.selectEquipment);

  // Close property panel when nothing is selected
  useEffect(() => {
    if (!selectedId) setPropertyOpen(false);
  }, [selectedId]);

  // Tablet: auto-open property panel when equipment becomes selected
  useEffect(() => {
    if (isTablet && selectedId) setPropertyOpen(true);
  }, [isTablet, selectedId]);

  // Mobile: close property sheet when selection changes (re-open manually)
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isMobile && selectedId !== prevSelectedIdRef.current) {
      setPropertyOpen(false);
    }
    prevSelectedIdRef.current = selectedId;
  }, [isMobile, selectedId]);

  const canvasArea = (
    <div className="relative flex-1">
      {has3DLoaded && (
        <div
          className="absolute inset-0"
          style={{
            visibility: is3D ? "visible" : "hidden",
            pointerEvents: is3D ? "auto" : "none",
          }}
        >
          <ThreeDErrorBoundary is3D={is3D}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Laddar 3D-vy…
                </div>
              }
            >
              <Hall3D className="h-full w-full" />
            </Suspense>
          </ThreeDErrorBoundary>
        </div>
      )}
      {!is3D && (
        <HallStage
          className="absolute inset-0"
          onStageReady={handleStageReady}
          onRequestAddEquipment={() => setPaletteOpen(true)}
        />
      )}
    </div>
  );

  // I spelläge: visa bara canvasarean (GameHUD hanterar exit-knapp)
  if (gameMode) {
    return (
      <div className="flex h-full flex-col">
        <main className="relative flex min-w-0 flex-1 flex-col">
          {canvasArea}
        </main>
        <GymnastTuningPanel />
        <ExerciseStudio open={studioOpen} onClose={() => setStudioOpen(false)} />
        <GymnastStylePanel open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
        <AccountPanel />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar stageRef={stageRef} />

      {/* ── Desktop layout: always-visible sidebars ── */}
      {isDesktop && (
        <div className="flex min-h-0 flex-1">
          <aside className="w-72 shrink-0 border-r border-surface-3 bg-surface-1">
            <EquipmentPalette />
          </aside>
          <main className="relative flex min-w-0 flex-1 flex-col">
            {canvasArea}
          </main>
          <aside className="w-80 shrink-0 border-l border-surface-3 bg-surface-1">
            <PropertyPanel />
          </aside>
        </div>
      )}

      {/* ── Tablet layout: collapsible push-in panels (like desktop) ── */}
      {isTablet && (
        <div className="flex min-h-0 flex-1">
          {paletteOpen && (
            <aside className="flex w-72 shrink-0 flex-col border-r border-surface-3 bg-surface-1">
              <div className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Redskap
                </span>
                <button
                  type="button"
                  onClick={() => setPaletteOpen(false)}
                  className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-surface-2"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <EquipmentPalette />
              </div>
            </aside>
          )}
          <main className="relative flex min-w-0 flex-1 flex-col">
            {!paletteOpen && (
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Visa redskap"
                className="absolute left-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-2xl border border-white/30 bg-accent text-white shadow-lg backdrop-blur-sm transition hover:opacity-90 active:scale-95"
              >
                <Plus size={20} strokeWidth={2.5} />
              </button>
            )}
            {canvasArea}
          </main>
          {propertyOpen && (
            <aside className="w-80 shrink-0 border-l border-surface-3 bg-surface-1">
              <PropertyPanel onClose={() => setPropertyOpen(false)} />
            </aside>
          )}
        </div>
      )}

      {/* ── Mobile layout: top-left open button + bottom sheets ── */}
      {isMobile && (
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="relative flex min-w-0 flex-1 flex-col">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Visa redskap"
              className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-accent text-white shadow-lg backdrop-blur-sm transition active:scale-95"
            >
              <Plus size={22} strokeWidth={2.5} />
            </button>
            {canvasArea}
          </main>

          {/* Selection bar – förbättrad med bättre touch-targets */}
          {selectedId && !propertyOpen && (
            <div className="safe-bottom flex items-center gap-2 border-t border-surface-3 bg-white/95 px-4 py-2.5 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                {selectedLabel}
              </span>
              <button
                type="button"
                onClick={() => setPropertyOpen(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:opacity-80"
              >
                <Settings2 size={14} /> Egenskaper
              </button>
              <button
                type="button"
                onClick={() => selectEquipment(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-slate-500 active:bg-surface-3"
                aria-label="Avmarkera"
              >
                <X size={16} />
              </button>
            </div>
          )}

        </div>
      )}

      <CommandPalette />
      <EquipmentEditor />

      {/* Mobile-only: bottom sheets */}
      {isMobile && (
        <>
          <BottomSheet
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            title="Redskap"
            heightPct={82}
          >
            <EquipmentPalette
              compact
              onItemActivate={() => setPaletteOpen(false)}
            />
          </BottomSheet>

          <BottomSheet
            open={propertyOpen}
            onClose={() => {
              setPropertyOpen(false);
              usePlanStore.getState().selectEquipment(null);
            }}
            heightPct={78}
          >
            <PropertyPanel onClose={() => setPropertyOpen(false)} />
          </BottomSheet>
        </>
      )}

      <GymnastTuningPanel />
      <ExerciseStudio open={studioOpen} onClose={() => setStudioOpen(false)} />
      <GymnastStylePanel open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
      <AccountPanel />
    </div>
  );
}
