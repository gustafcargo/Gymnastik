import { useCallback, useEffect, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Layer, Stage } from "react-konva";
import type Konva from "konva";
import { HallFloor } from "./HallFloor";
import { EquipmentNode } from "./EquipmentNode";
import { usePlanStore } from "../../store/usePlanStore";
import { computePixelsPerMeter } from "../../lib/geometry";

type Props = {
  className?: string;
  onStageReady?: (stage: Konva.Stage) => void;
};

/**
 * Canvas med idrottshallen. Hanterar zoom (mushjul + pinch), pan (drag på
 * tom yta) och är drop-target för redskap från paletten.
 */
export function HallStage({ className, onStageReady }: Props) {
  const plan = usePlanStore((s) => s.plan);
  const activeStation = plan.stations.find(
    (s) => s.id === plan.activeStationId,
  );
  const selectedId = usePlanStore((s) => s.selectedEquipmentId);
  const selectEquipment = usePlanStore((s) => s.selectEquipment);
  const addEquipment = usePlanStore((s) => s.addEquipment);
  const viewMode = usePlanStore((s) => s.viewMode);
  const is3D = viewMode === "3D";

  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [fitOffset, setFitOffset] = useState({ x: 0, y: 0 });

  // Observera storleksändringar
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  // Räkna ut skala och offset så hallen passar in med lite padding
  useEffect(() => {
    const padding = 48;
    const pxPerM = computePixelsPerMeter(
      size.width,
      size.height,
      plan.hall.widthM,
      plan.hall.heightM,
      padding,
    );
    setFitScale(pxPerM);
    const hallPxW = plan.hall.widthM * pxPerM;
    const hallPxH = plan.hall.heightM * pxPerM;
    setFitOffset({
      x: (size.width - hallPxW) / 2,
      y: (size.height - hallPxH) / 2,
    });
  }, [size, plan.hall]);

  useEffect(() => {
    if (stageRef.current && onStageReady) onStageReady(stageRef.current);
  }, [onStageReady]);

  // Zoom med mushjul (Ctrl/Cmd) + trackpad-pinch
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    // Trackpad pinch sends ctrlKey=true with wheel; normal wheel = pan
    if (!e.evt.ctrlKey && !e.evt.metaKey) return;
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = stageScale;
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? 1 / scaleBy : scaleBy;
    const newScale = Math.min(6, Math.max(0.3, oldScale * direction));
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stagePos, stageScale]);

  // Pan via drag på tom yta
  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      selectEquipment(null);
    }
  };

  const resetView = useCallback(() => {
    setStagePos({ x: 0, y: 0 });
    setStageScale(1);
  }, []);

  // Exponera reset via global event (används av Toolbar-knapp)
  useEffect(() => {
    const handler = () => resetView();
    window.addEventListener("gymnastik:fit-view", handler);
    return () => window.removeEventListener("gymnastik:fit-view", handler);
  }, [resetView]);

  // HTML5-drop från paletten → skapa redskap
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-gymnastik-equipment")) {
      e.preventDefault();
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    const typeId = e.dataTransfer.getData("application/x-gymnastik-equipment");
    if (!typeId || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    // Mus-pos relativt stage
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Konvertera till hall-koordinater (meter)
    const hallPxX = (px - stagePos.x) / stageScale - fitOffset.x;
    const hallPxY = (py - stagePos.y) / stageScale - fitOffset.y;
    const xM = hallPxX / fitScale;
    const yM = hallPxY / fitScale;
    addEquipment(typeId, xM, yM);
  };

  const isEmpty = !activeStation?.equipment.length;

  return (
    <div
      ref={containerRef}
      className={className + " relative"}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ touchAction: "none" }}
    >
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="pointer-events-auto max-w-xs rounded-2xl bg-white/85 px-5 py-4 text-center shadow-xs backdrop-blur">
            <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Dra ditt första redskap hit
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Hämta från vänster panel eller tryck <kbd className="rounded bg-surface-2 px-1 font-mono">⌘K</kbd>.
            </p>
          </div>
        </div>
      )}
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onMouseDown={handleStageClick}
        onTouchStart={handleStageClick}
      >
        <Layer>
          <Group
            x={fitOffset.x + (is3D ? plan.hall.widthM * fitScale * 0.15 : 0)}
            y={fitOffset.y + (is3D ? plan.hall.heightM * fitScale * 0.18 : 0)}
            scaleY={is3D ? 0.62 : 1}
            skewX={is3D ? -0.32 : 0}
          >
            <HallFloor hall={plan.hall} pxPerM={fitScale} />
            {activeStation?.equipment.map((eq) => (
              <EquipmentNode
                key={eq.id}
                equipment={eq}
                pxPerM={fitScale}
                hallWidthM={plan.hall.widthM}
                hallHeightM={plan.hall.heightM}
                isSelected={eq.id === selectedId}
                is3D={is3D}
                onSelect={() => selectEquipment(eq.id)}
              />
            ))}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
