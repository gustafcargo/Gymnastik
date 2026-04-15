import { Component, lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type Konva from "konva";
import { Settings2, X } from "lucide-react";
import { Toolbar } from "./components/Toolbar";
import { EquipmentPalette } from "./components/Sidebar/EquipmentPalette";
import { PropertyPanel } from "./components/Sidebar/PropertyPanel";
import { HallStage } from "./components/Canvas/HallStage";
import { StationTimeline } from "./components/Timeline/StationTimeline";
import { CommandPalette } from "./components/CommandPalette";
import { FabButton } from "./components/Mobile/FabButton";
import { BottomSheet } from "./components/Mobile/BottomSheet";
import { EquipmentEditor } from "./components/EquipmentEditor/EquipmentEditor";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePlanStore } from "./store/usePlanStore";
import { getEquipmentById } from "./catalog/equipment";

// Lazy-loada 3D-vyn så three.js inte hamnar i initial-bundle
const Hall3D = lazy(() =>
  import("./components/Canvas3D/Hall3D").then((m) => ({ default: m.Hall3D })),
);

/** Fångar krascher i 3D-vyn och återställer till 2D-läge. */
class ThreeDErrorBoundary extends Component<
  { children: ReactNode; onRegisterReset: (fn: () => void) => void },
  { crashed: boolean }
> {
  state = { crashed: false };

  componentDidMount() {
    this.props.onRegisterReset(() => this.setState({ crashed: false }));
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[3D] krasch – återgår till 2D:", err.message);
    usePlanStore.getState().setViewMode("2D");
  }
  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}

export default function App() {
  useKeyboardShortcuts();
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
  const is3D = viewMode === "3D";

  const plan = usePlanStore((s) => s.plan);
  const selectedEq = selectedId
    ? plan.stations
        .find((s) => s.id === plan.activeStationId)
        ?.equipment.find((e) => e.id === selectedId)
    : null;
  const selectedType = selectedEq ? getEquipmentById(selectedEq.typeId) : null;
  const selectedLabel = selectedEq?.label ?? selectedType?.name ?? "";

  const reset3DRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (is3D) reset3DRef.current();
  }, [is3D]);

  const [has3DLoaded, setHas3DLoaded] = useState(
    () => usePlanStore.getState().viewMode === "3D",
  );
  useEffect(() => {
    if (is3D) setHas3DLoaded(true);
  }, [is3D]);

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
          <ThreeDErrorBoundary
            onRegisterReset={(fn) => {
              reset3DRef.current = fn;
            }}
          >
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
          onStageReady={(s) => (stageRef.current = s)}
        />
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        stageRef={stageRef}
        onToggleSidebar={
          !isDesktop ? () => setPaletteOpen((o) => !o) : undefined
        }
      />

      {/* ── Desktop layout: always-visible sidebars ── */}
      {isDesktop && (
        <div className="flex min-h-0 flex-1">
          <aside className="w-72 shrink-0 border-r border-surface-3 bg-surface-1">
            <EquipmentPalette />
          </aside>
          <main className="relative flex min-w-0 flex-1 flex-col">
            {canvasArea}
            <StationTimeline />
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
            {canvasArea}
            <StationTimeline />
          </main>
          {propertyOpen && (
            <aside className="w-80 shrink-0 border-l border-surface-3 bg-surface-1">
              <PropertyPanel onClose={() => setPropertyOpen(false)} />
            </aside>
          )}
        </div>
      )}

      {/* ── Mobile layout: FAB + bottom sheets ── */}
      {isMobile && (
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="relative flex min-w-0 flex-1 flex-col">
            {canvasArea}
            <StationTimeline />
          </main>
        </div>
      )}

      <CommandPalette />
      <EquipmentEditor />

      {/* Mobile-only: FAB, selection bar, bottom sheets */}
      {isMobile && (
        <>
          <FabButton onClick={() => setPaletteOpen(true)} />

          {selectedId && !propertyOpen && (
            <div
              className="fixed bottom-24 left-4 right-20 z-30 flex items-center gap-2 rounded-2xl border border-surface-3 bg-white px-4 py-2.5 shadow-lg"
              style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                {selectedLabel}
              </span>
              <button
                type="button"
                onClick={() => setPropertyOpen(true)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Settings2 size={13} /> Egenskaper
              </button>
              <button
                type="button"
                onClick={() => selectEquipment(null)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-2"
                aria-label="Avmarkera"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <BottomSheet
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            title="Redskap"
            heightPct={78}
          >
            <EquipmentPalette
              compact
              onItemActivate={(typeId) => {
                usePlanStore.getState().addEquipmentCenter(typeId);
                setPaletteOpen(false);
              }}
            />
          </BottomSheet>

          <BottomSheet
            open={propertyOpen}
            onClose={() => {
              setPropertyOpen(false);
              usePlanStore.getState().selectEquipment(null);
            }}
            heightPct={62}
          >
            <PropertyPanel onClose={() => setPropertyOpen(false)} />
          </BottomSheet>
        </>
      )}
    </div>
  );
}
