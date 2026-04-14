import { useRef, useState } from "react";
import type Konva from "konva";
import { Toolbar } from "./components/Toolbar";
import { EquipmentPalette } from "./components/Sidebar/EquipmentPalette";
import { PropertyPanel } from "./components/Sidebar/PropertyPanel";
import { HallStage } from "./components/Canvas/HallStage";
import { StationTimeline } from "./components/Timeline/StationTimeline";
import { CommandPalette } from "./components/CommandPalette";
import { FabButton } from "./components/Mobile/FabButton";
import { BottomSheet } from "./components/Mobile/BottomSheet";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePlanStore } from "./store/usePlanStore";

export default function App() {
  useKeyboardShortcuts();
  const stageRef = useRef<Konva.Stage | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const selectedId = usePlanStore((s) => s.selectedEquipmentId);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);

  // Öppna property-sheet på mobil när något markeras
  if (!isDesktop && selectedId && !propertyOpen) {
    // lazy trigger – undvik setState-i-render genom microtask
    queueMicrotask(() => setPropertyOpen(true));
  }

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
          <HallStage
            className="flex-1"
            onStageReady={(s) => (stageRef.current = s)}
          />
          <StationTimeline />
        </main>

        {isDesktop && (
          <aside className="w-80 shrink-0 border-l border-surface-3 bg-surface-1">
            <PropertyPanel />
          </aside>
        )}
      </div>

      <CommandPalette />

      {/* Mobil */}
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
