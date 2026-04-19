import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Layer, Stage } from "react-konva";
import type Konva from "konva";
import { HallFloor } from "./HallFloor";
import { EquipmentNode } from "./EquipmentNode";
import { EquipmentNoteBubble } from "./EquipmentNoteBubble";
import { usePlanStore } from "../../store/usePlanStore";
import { computePixelsPerMeter } from "../../lib/geometry";
import { computeStackInfo } from "../../lib/stackGroups";
import { getEquipmentById } from "../../catalog/equipment";

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
  const updateEquipment = usePlanStore((s) => s.updateEquipment);
  const setEquipmentNoteOffset = usePlanStore((s) => s.setEquipmentNoteOffset);
  const setEquipmentNoteSize = usePlanStore((s) => s.setEquipmentNoteSize);
  const showNotes = usePlanStore((s) => s.showNotes);

  const stackInfo = useMemo(
    () => computeStackInfo(activeStation?.equipment ?? []),
    [activeStation?.equipment],
  );

  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  /**
   * När containern är liggande men hallen är stående (eller vice versa)
   * roterar vi hallen 90° så dess långsida följer containerns långsida.
   * Detta gör att hela skärmbredden används även när telefonen läggs på
   * sidan. Koordinater i hall-space förblir oförändrade; bara den yttre
   * Group:en roteras.
   */
  const [hallRotated, setHallRotated] = useState(false);

  type EditingNote = { id: string; x: number; y: number; text: string };
  const [editingNote, setEditingNote] = useState<EditingNote | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Observera storleksändringar. På iOS triggar orienteringsbyten inte
  // alltid ResizeObserver pålitligt, så vi lyssnar även på window resize
  // + visualViewport för att säkerställa att hallen breder ut sig över
  // hela tillgängliga ytan när användaren lägger telefonen på sidan.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      vv?.removeEventListener("resize", measure);
    };
  }, []);

  // Räkna ut skala och rotation så hallens långsida hamnar längs
  // containerns långsida. På en liggande iPhone med en stående hall
  // ger det en 90°-rotation som fyller hela skärmbredden.
  useEffect(() => {
    const padding = 48;
    const normalPxPerM = computePixelsPerMeter(
      size.width,
      size.height,
      plan.hall.widthM,
      plan.hall.heightM,
      padding,
    );
    const rotatedPxPerM = computePixelsPerMeter(
      size.width,
      size.height,
      plan.hall.heightM,
      plan.hall.widthM,
      padding,
    );
    const rotate = rotatedPxPerM > normalPxPerM;
    setHallRotated(rotate);
    setFitScale(rotate ? rotatedPxPerM : normalPxPerM);
  }, [size, plan.hall]);

  useEffect(() => {
    if (stageRef.current && onStageReady) onStageReady(stageRef.current);
  }, [onStageReady]);

  // Hallens naturliga storlek i px (utan rotation) och dess synliga AABB
  // efter ev. 90°-rotation. Rotationen sker kring hallens centrum som
  // placeras i containerns mitt, så AABB-bredden blir hallens höjd vid
  // rotation (och tvärtom).
  const hallPxW = plan.hall.widthM * fitScale;
  const hallPxH = plan.hall.heightM * fitScale;
  const displayedW = hallRotated ? hallPxH : hallPxW;
  const displayedH = hallRotated ? hallPxW : hallPxH;
  const centerX = size.width / 2;
  const centerY = size.height / 2;

  /**
   * Clamp stagePos so the hall is never fully scrolled off-screen.
   * At least `margin` px of the hall rectangle must remain visible.
   */
  const clampPos = useCallback(
    (pos: { x: number; y: number }, scale: number) => {
      const margin = 60;
      const halfW = (displayedW * scale) / 2;
      const halfH = (displayedH * scale) / 2;
      const hallCX = pos.x + centerX * scale;
      const hallCY = pos.y + centerY * scale;
      const hallLeft = hallCX - halfW;
      const hallTop = hallCY - halfH;
      const hallRight = hallCX + halfW;
      const hallBottom = hallCY + halfH;

      let dx = 0;
      let dy = 0;
      if (hallRight < margin) dx = margin - hallRight;
      else if (hallLeft > size.width - margin) dx = size.width - margin - hallLeft;
      if (hallBottom < margin) dy = margin - hallBottom;
      else if (hallTop > size.height - margin) dy = size.height - margin - hallTop;

      return { x: pos.x + dx, y: pos.y + dy };
    },
    [centerX, centerY, displayedW, displayedH, size],
  );

  /**
   * Konvertera en punkt i container-px till hall-koordinater (meter).
   * Omvänder stage-pan/zoom, 90°-rotationen och centrering av hallen.
   */
  const containerToHallM = useCallback(
    (px: number, py: number): { xM: number; yM: number } => {
      const stageLocalX = (px - stagePos.x) / stageScale;
      const stageLocalY = (py - stagePos.y) / stageScale;
      const dx = stageLocalX - centerX;
      const dy = stageLocalY - centerY;
      // Invers rotation: om hallRotated är +90°, snurra punkten -90°.
      const angle = hallRotated ? -Math.PI / 2 : 0;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const hallLocalX = dx * cos - dy * sin + hallPxW / 2;
      const hallLocalY = dx * sin + dy * cos + hallPxH / 2;
      return { xM: hallLocalX / fitScale, yM: hallLocalY / fitScale };
    },
    [stagePos, stageScale, centerX, centerY, hallRotated, hallPxW, hallPxH, fitScale],
  );

  /**
   * Konvertera en punkt i hall-koordinater (px) till container-px.
   * Används för att placera HTML-overlays (note-editor) korrekt även
   * när hallen är roterad.
   */
  const hallPxToContainer = useCallback(
    (hallX: number, hallY: number): { x: number; y: number } => {
      const dx = hallX - hallPxW / 2;
      const dy = hallY - hallPxH / 2;
      const angle = hallRotated ? Math.PI / 2 : 0;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const stageLocalX = dx * cos - dy * sin + centerX;
      const stageLocalY = dx * sin + dy * cos + centerY;
      return {
        x: stagePos.x + stageLocalX * stageScale,
        y: stagePos.y + stageLocalY * stageScale,
      };
    },
    [stagePos, stageScale, centerX, centerY, hallRotated, hallPxW, hallPxH],
  );

  // Zoom med mushjul + trackpad-pinch
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
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
    const newScale = Math.min(6, Math.max(0.15, oldScale * direction));
    const rawPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setStageScale(newScale);
    setStagePos(clampPos(rawPos, newScale));
  }, [stagePos, stageScale, clampPos]);

  // Pan via drag på tom yta
  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      selectEquipment(null);
    }
  };

  // Pinch-to-zoom for touch devices
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  const getTouchCenter = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDist.current = getTouchDist(e.touches[0], e.touches[1]);
      lastCenter.current = getTouchCenter(e.touches[0], e.touches[1]);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !containerRef.current) return;
    e.preventDefault();
    const dist = getTouchDist(e.touches[0], e.touches[1]);
    const center = getTouchCenter(e.touches[0], e.touches[1]);
    const rect = containerRef.current.getBoundingClientRect();

    if (lastDist.current > 0) {
      const scaleChange = dist / lastDist.current;
      const newScale = Math.min(6, Math.max(0.3, stageScale * scaleChange));
      // Zoom toward pinch center
      const px = center.x - rect.left;
      const py = center.y - rect.top;
      const pointTo = {
        x: (px - stagePos.x) / stageScale,
        y: (py - stagePos.y) / stageScale,
      };
      // Also pan by center movement
      const panDx = lastCenter.current ? center.x - lastCenter.current.x : 0;
      const panDy = lastCenter.current ? center.y - lastCenter.current.y : 0;
      setStageScale(newScale);
      setStagePos(clampPos({
        x: px - pointTo.x * newScale + panDx,
        y: py - pointTo.y * newScale + panDy,
      }, newScale));
    }
    lastDist.current = dist;
    lastCenter.current = center;
  };

  const handleTouchEnd = () => {
    lastDist.current = 0;
    lastCenter.current = null;
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
      setIsDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when leaving the container itself, not child elements
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    const typeId = e.dataTransfer.getData("application/x-gymnastik-equipment");
    if (!typeId || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { xM, yM } = containerToHallM(px, py);
    addEquipment(typeId, xM, yM);
  };

  const isEmpty = !activeStation?.equipment.length;

  return (
    // Outer div takes the className from App (e.g. "absolute inset-0") for
    // positioning. Inner div is "h-full w-full relative" so the ResizeObserver
    // measures the true available area and the isEmpty overlay is contained.
    <div className={className}>
    <div
      ref={containerRef}
      className="h-full w-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "none" }}
    >
      {/* Inline note-editing textarea overlay */}
      {editingNote && (
        <div
          style={{
            position: "absolute",
            left: editingNote.x - 65,
            top: editingNote.y - 35,
            zIndex: 30,
          }}
        >
          <textarea
            autoFocus
            defaultValue={editingNote.text}
            rows={4}
            onBlur={(e) => {
              updateEquipment(editingNote.id, { notes: e.target.value || undefined });
              setEditingNote(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingNote(null);
            }}
            style={{
              width: "130px",
              background: "rgba(255,251,210,0.98)",
              border: "2px solid #3B82F6",
              borderRadius: "6px",
              padding: "7px",
              fontSize: "11px",
              color: "#374151",
              resize: "none",
              outline: "none",
              lineHeight: "1.4",
              fontFamily: "system-ui, sans-serif",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      )}

      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 rounded-sm border-4 border-dashed border-accent/70 bg-accent/5" />
      )}
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
            const raw = { x: e.target.x(), y: e.target.y() };
            const clamped = clampPos(raw, stageScale);
            setStagePos(clamped);
            e.target.position(clamped);
          }
        }}
        onWheel={handleWheel}
        onMouseDown={handleStageClick}
        onTouchStart={handleStageClick}
      >
        <Layer>
          <Group
            x={centerX}
            y={centerY}
            offsetX={hallPxW / 2}
            offsetY={hallPxH / 2}
            rotation={hallRotated ? 90 : 0}
          >
            <HallFloor hall={plan.hall} pxPerM={fitScale} title={plan.name} />
            {[...(activeStation?.equipment ?? [])]
              .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
              .map((eq) => (
              <EquipmentNode
                key={eq.id}
                equipment={eq}
                pxPerM={fitScale}
                hallWidthM={plan.hall.widthM}
                hallHeightM={plan.hall.heightM}
                isSelected={eq.id === selectedId}
                stackInfo={stackInfo.get(eq.id)}
                onSelect={() => selectEquipment(eq.id)}
              />
            ))}
          </Group>
        </Layer>

        {/* Note bubbles – separate layer so they render above equipment */}
        {showNotes && (
          <Layer>
            <Group
              x={centerX}
              y={centerY}
              offsetX={hallPxW / 2}
              offsetY={hallPxH / 2}
              rotation={hallRotated ? 90 : 0}
            >
              {activeStation?.equipment.map((eq) => {
                if (!eq.notes) return null;
                const type = getEquipmentById(eq.typeId);
                if (!type) return null;
                return (
                  <EquipmentNoteBubble
                    key={`note-${eq.id}`}
                    eq={eq}
                    type={type}
                    pxPerM={fitScale}
                    onOffsetChange={(offset) =>
                      setEquipmentNoteOffset(eq.id, offset)
                    }
                    onSizeChange={(size) =>
                      setEquipmentNoteSize(eq.id, size)
                    }
                    onSelect={() => selectEquipment(eq.id)}
                    onStartEdit={() => {
                      const offset = eq.noteOffset ?? {
                        x: type.widthM / 2 + 0.6,
                        y: -(type.heightM / 2 + 1.0),
                      };
                      const bubbleCx = (eq.x + offset.x) * fitScale;
                      const bubbleCy = (eq.y + offset.y) * fitScale;
                      const screen = hallPxToContainer(bubbleCx, bubbleCy);
                      setEditingNote({ id: eq.id, x: screen.x, y: screen.y, text: eq.notes ?? "" });
                    }}
                  />
                );
              })}
            </Group>
          </Layer>
        )}
      </Stage>
    </div>
    </div>
  );
}
