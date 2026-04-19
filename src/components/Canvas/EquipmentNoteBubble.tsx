import { useRef } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { PlacedEquipment, EquipmentType } from "../../types";

type Props = {
  eq: PlacedEquipment;
  type: EquipmentType;
  pxPerM: number;
  onOffsetChange: (offset: { x: number; y: number }) => void;
  onSelect?: () => void;
  onStartEdit?: () => void;
};

const BUBBLE_W = 130;
const BUBBLE_PADDING = 7;
const FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const MAX_LINES = 4;
const BUBBLE_H = BUBBLE_PADDING * 2 + LINE_HEIGHT * MAX_LINES;

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

export function EquipmentNoteBubble({ eq, type, pxPerM, onOffsetChange, onSelect, onStartEdit }: Props) {
  const offset = eq.noteOffset ?? defaultOffset(type);

  // Connector line is updated imperatively during drag to avoid React state re-renders.
  // Re-renders during drag reset the controlled x/y props and corrupt Konva's drag position
  // (especially visible on mobile where renders are slower).
  const lineRef = useRef<Konva.Line>(null);

  const eqCx = eq.x * pxPerM;
  const eqCy = eq.y * pxPerM;
  const bubbleCx = (eq.x + offset.x) * pxPerM;
  const bubbleCy = (eq.y + offset.y) * pxPerM;

  // Halva redskapets footprint + halva anteckningsrutan — används för att
  // klippa linjen till bådas kanter så den inte går över etiketten/texten.
  const eqHW = (type.widthM * pxPerM) / 2;
  const eqHH = (type.heightM * pxPerM) / 2;
  const bubbleHW = BUBBLE_W / 2;
  const bubbleHH = BUBBLE_H / 2;

  const computeLinePoints = (bx: number, by: number) => {
    const eqEdge = clipToBoxEdge(
      { x: eqCx, y: eqCy },
      { x: bx, y: by },
      eqHW,
      eqHH,
    );
    const bubbleEdge = clipToBoxEdge(
      { x: bx, y: by },
      { x: eqCx, y: eqCy },
      bubbleHW,
      bubbleHH,
    );
    return [eqEdge.x, eqEdge.y, bubbleEdge.x, bubbleEdge.y];
  };

  const initialPoints = computeLinePoints(bubbleCx, bubbleCy);

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    lineRef.current?.points(computeLinePoints(e.target.x(), e.target.y()));
    lineRef.current?.getLayer()?.batchDraw();
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const cx = e.target.x();
    const cy = e.target.y();
    onOffsetChange({ x: cx / pxPerM - eq.x, y: cy / pxPerM - eq.y });
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
        x={bubbleCx}
        y={bubbleCy}
        offsetX={BUBBLE_W / 2}
        offsetY={BUBBLE_H / 2}
        draggable
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onClick={(e) => { e.cancelBubble = true; onSelect?.(); }}
        onTap={(e) => { e.cancelBubble = true; onSelect?.(); }}
        onDblClick={(e) => { e.cancelBubble = true; onStartEdit?.(); }}
      >
        {/* Card background */}
        <Rect
          width={BUBBLE_W}
          height={BUBBLE_H}
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
          x={BUBBLE_PADDING}
          y={BUBBLE_PADDING}
          width={BUBBLE_W - BUBBLE_PADDING * 2}
          height={BUBBLE_H - BUBBLE_PADDING * 2}
          text={eq.notes ?? ""}
          fontSize={FONT_SIZE}
          lineHeight={LINE_HEIGHT / FONT_SIZE}
          fill="#374151"
          wrap="word"
          ellipsis
        />
      </Group>
    </>
  );
}
