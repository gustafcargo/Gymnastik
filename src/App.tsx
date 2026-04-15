import { Component, lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type Konva from "konva";
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

// Lazy-loada 3D-vyn så three.js inte hamnar i initial-bundle
const Hall3D = lazy(() =>
  import("./components/Canvas3D/Hall3D").then((m) => ({ default: m.Hall3D })),
);

/** Fångar krascher i 3D-vyn och återställer till 2D-läge.
 *  Exponerar en reset-funktion via onRegisterReset så att föräldern kan
 *  nollställa tillståndet nästa gång användaren byter till 3D. */
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
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const selectedId = usePlanStore((s) => s.selectedEquipmentId);
  const viewMode = usePlanStore((s) => s.viewMode);
  const is3D = viewMode === "3D";

  // Ref to ThreeDErrorBoundary's reset function.
  // Called every time the user switches to 3D so the boundary doesn't stay
  // permanently crashed after a previous error.
  const reset3DRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (is3D) reset3DRef.current();
  }, [is3D]);

  // Once 3D has been requested we keep the Canvas mounted forever.
  // Unmounting a Three.js/WebGL Canvas tears down the GL context which
  // occasionally throws and crashes the whole app. Hiding it with CSS
  // is the safe alternative.
  const [has3DLoaded, setHas3DLoaded] = useState(
    () => usePlanStore.getState().viewMode === "3D",
  );
  useEffect(() => {
    if (is3D) setHas3DLoaded(true);
  }, [is3D]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);

  useEffect(() => {
    if (!isDesktop && selectedId) setPropertyOpen(true);
  }, [isDesktop, selectedId]);

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        stageRef={stageRef}
        onToggleSidebar={
          isDesktop ? undefined : () => setPaletteOpen((o) => !o)
        }
      />

      <div className="flex min-h-0 flex-1">
        {isDesktop && (
          <aside className="w-72 shrink-0 border-r border-surface-3 bg-surface-1">
            <EquipmentPalette />
          </aside>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Delade canvas-ytan – båda ligger i samma absoluta container
              så Three.js-canvas alltid har rätt storlek (aldrig 0×0). */}
          <div className="relative flex-1">
            {/* Three.js – monteras en gång, göms med visibility (ej display:none) */}
            {has3DLoaded && (
              <div
                className="absolute inset-0"
                style={{
                  visibility: is3D ? "visible" : "hidden",
                  pointerEvents: is3D ? "auto" : "none",
                }}
              >
                <ThreeDErrorBoundary onRegisterReset={(fn) => { reset3DRef.current = fn; }}>
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

            {/* 2D Konva – monteras/avmonteras normalt */}
            {!is3D && (
              <HallStage
                className="absolute inset-0"
                onStageReady={(s) => (stageRef.current = s)}
              />
            )}
          </div>
          <StationTimeline />
        </main>

        {isDesktop && (
          <aside className="w-80 shrink-0 border-l border-surface-3 bg-surface-1">
            <PropertyPanel />
          </aside>
        )}
      </div>

      <CommandPalette />
      <EquipmentEditor />

      {!isDesktop && (
        <>
          <FabButton onClick={() => setPaletteOpen(true)} />
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
