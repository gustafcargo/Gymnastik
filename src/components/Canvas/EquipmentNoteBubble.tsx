import { useRef } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { PlacedEquipment, EquipmentType } from "../../types";

type Props = {
  eq: PlacedEquipment;
  type: EquipmentType;
  pxPerM: number;
  onOffsetChange: (offset: { x: number; y: number }) => void;
  onSizeChange?: (size: { w: number; h: number }) => void;
  onSelect?: () => void;
  onStartEdit?: () => void;
};

const DEFAULT_BUBBLE_W = 130;
const BUBBLE_PADDING = 7;
const FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const DEFAULT_MAX_LINES = 4;
const DEFAULT_BUBBLE_H = BUBBLE_PADDING * 2 + LINE_HEIGHT * DEFAULT_MAX_LINES;
const MIN_W = 70;
const MIN_H = 32;
const HANDLE_R = 5;

/** Default bubble offset: place it above-right of the equipment. */
function defaultOffset(type: EquipmentType) {
  return { x: type.widthM / 2 + 0.6, y: -(type.heightM / 2 + 1.0) };
}

/**
 * Klipper en stråle från `from` till `to` så att den slutar på kanten av en
 * axeljusterad rektangel centrerad runt `from` med halv-storlek (hw, hh).
 */
function clipToBoxEdge(
  from: { x: number; y: number },
  to: { x: number; y: number },
  hw: number,
  hh: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return from;
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty, 1);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

export function EquipmentNoteBubble({
  eq,
  type,
  pxPerM,
  onOffsetChange,
  onSizeChange,
  onSelect,
  onStartEdit,
}: Props) {
  const offset = eq.noteOffset ?? defaultOffset(type);
  const size = eq.noteSize ?? { w: DEFAULT_BUBBLE_W, h: DEFAULT_BUBBLE_H };
  const bubbleW = size.w;
  const bubbleH = size.h;

  // Refs så drag av bubbla och resize-handtag kan uppdatera linje + Rect
  // imperativt utan att orsaka React-renders mitt i en drag-gest.
  const lineRef = useRef<Konva.Line>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const textRef = useRef<Konva.Text>(null);
  const groupRef = useRef<Konva.Group>(null);
  const handleRef = useRef<Konva.Circle>(null);

  const eqCx = eq.x * pxPerM;
  const eqCy = eq.y * pxPerM;
  const bubbleCx = (eq.x + offset.x) * pxPerM;
  const bubbleCy = (eq.y + offset.y) * pxPerM;

  const eqHW = (type.widthM * pxPerM) / 2;
  const eqHH = (type.heightM * pxPerM) / 2;

  const computeLinePoints = (bx: number, by: number, w: number, h: number) => {
    const eqEdge = clipToBoxEdge(
      { x: eqCx, y: eqCy },
      { x: bx, y: by },
      eqHW,
      eqHH,
    );
    const bubbleEdge = clipToBoxEdge(
      { x: bx, y: by },
      { x: eqCx, y: eqCy },
      w / 2,
      h / 2,
    );
    return [eqEdge.x, eqEdge.y, bubbleEdge.x, bubbleEdge.y];
  };

  const initialPoints = computeLinePoints(bubbleCx, bubbleCy, bubbleW, bubbleH);

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    lineRef.current?.points(
      computeLinePoints(e.target.x(), e.target.y(), bubbleW, bubbleH),
    );
    lineRef.current?.getLayer()?.batchDraw();
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const cx = e.target.x();
    const cy = e.target.y();
    onOffsetChange({ x: cx / pxPerM - eq.x, y: cy / pxPerM - eq.y });
  };

  // Resize via nedre höger hörn. Handtaget draggas fritt i layer-space,
  // vi räknar om storleken relativt bubbelns centrum och håller centrum
  // stilla (hörnet = center + (w/2, h/2)).
  const handleResizeDragMove = (e: KonvaEventObject<DragEvent>) => {
    const hx = e.target.x();
    const hy = e.target.y();
    // Hörnets position i layer-space → bredd/höjd (minst MIN)
    const newW = Math.max(MIN_W, (hx - bubbleCx) * 2);
    const newH = Math.max(MIN_H, (hy - bubbleCy) * 2);
    // Snappa handtaget till klampad storlek så det inte glider i väg
    e.target.x(bubbleCx + newW / 2);
    e.target.y(bubbleCy + newH / 2);

    rectRef.current?.width(newW);
    rectRef.current?.height(newH);
    textRef.current?.width(newW - BUBBLE_PADDING * 2);
    textRef.current?.height(newH - BUBBLE_PADDING * 2);
    groupRef.current?.offsetX(newW / 2);
    groupRef.current?.offsetY(newH / 2);
    lineRef.current?.points(computeLinePoints(bubbleCx, bubbleCy, newW, newH));
    lineRef.current?.getLayer()?.batchDraw();
  };

  const handleResizeDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const hx = e.target.x();
    const hy = e.target.y();
    const newW = Math.max(MIN_W, (hx - bubbleCx) * 2);
    const newH = Math.max(MIN_H, (hy - bubbleCy) * 2);
    onSizeChange?.({ w: newW, h: newH });
  };

  return (
    <>
      {/* Dashed connector line – clipped to both equipment and bubble edges */}
      <Line
        ref={lineRef}
        points={initialPoints}
        stroke="#475569"
        strokeWidth={1}
        dash={[5, 4]}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Note card – draggable, centered on (bubbleCx, bubbleCy) */}
      <Group
        ref={groupRef}
        x={bubbleCx}
        y={bubbleCy}
        offsetX={bubbleW / 2}
        offsetY={bubbleH / 2}
        draggable
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(); }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(); }}
        onDblClick={(e) => { e.cancelBubble = true; onStartEdit?.(); }}
      >
        {/* Card background */}
        <Rect
          ref={rectRef}
          width={bubbleW}
          height={bubbleH}
          fill="rgba(255,251,210,0.96)"
          stroke="#D4A820"
          strokeWidth={1}
          cornerRadius={6}
          shadowColor="rgba(0,0,0,0.18)"
          shadowBlur={6}
          shadowOffsetY={2}
        />
        {/* Note text */}
        <Text
          ref={textRef}
          x={BUBBLE_PADDING}
          y={BUBBLE_PADDING}
          width={bubbleW - BUBBLE_PADDING * 2}
          height={bubbleH - BUBBLE_PADDING * 2}
          text={eq.notes ?? ""}
          fontSize={FONT_SIZE}
          lineHeight={LINE_HEIGHT / FONT_SIZE}
          fill="#374151"
          wrap="word"
          ellipsis
        />
      </Group>

      {/* Resize-handtag (nedre höger hörn). Ligger som syskon till bubbel-
          gruppen i layer-space så vi kan läsa dess absoluta position
          direkt utan att kompensera för Group-offset under drag. */}
      {onSizeChange && (
        <Circle
          ref={handleRef}
          x={bubbleCx + bubbleW / 2}
          y={bubbleCy + bubbleH / 2}
          radius={HANDLE_R}
          fill="#D4A820"
          stroke="#fff"
          strokeWidth={1}
          draggable
          onDragMove={handleResizeDragMove}
          onDragEnd={handleResizeDragEnd}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = "nwse-resize";
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = "default";
          }}
        />
      )}
    </>
  );
}
