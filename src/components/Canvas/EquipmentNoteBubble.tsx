import { useState } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { PlacedEquipment, EquipmentType } from "../../types";

type Props = {
  eq: PlacedEquipment;
  type: EquipmentType;
  pxPerM: number;
  onOffsetChange: (offset: { x: number; y: number }) => void;
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

export function EquipmentNoteBubble({ eq, type, pxPerM, onOffsetChange, onStartEdit }: Props) {
  const offset = eq.noteOffset ?? defaultOffset(type);

  // Track bubble center during drag so the connector line updates in real-time
  const [dragCenter, setDragCenter] = useState<{ x: number; y: number } | null>(null);

  const eqCx = eq.x * pxPerM;
  const eqCy = eq.y * pxPerM;
  const bubbleCx = dragCenter?.x ?? (eq.x + offset.x) * pxPerM;
  const bubbleCy = dragCenter?.y ?? (eq.y + offset.y) * pxPerM;

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    // e.target.x/y is the group origin which equals the bubble center (offsetX/Y applied)
    setDragCenter({ x: e.target.x(), y: e.target.y() });
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const cx = e.target.x();
    const cy = e.target.y();
    setDragCenter(null);
    onOffsetChange({ x: cx / pxPerM - eq.x, y: cy / pxPerM - eq.y });
  };

  return (
    <>
      {/* Dashed connector line from equipment center to bubble center */}
      <Line
        points={[eqCx, eqCy, bubbleCx, bubbleCy]}
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
        onClick={(e) => e.cancelBubble = true}
        onTap={(e) => e.cancelBubble = true}
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

      {/* Small circle at equipment center to anchor the connector */}
      <Rect
        x={eqCx - 3}
        y={eqCy - 3}
        width={6}
        height={6}
        cornerRadius={3}
        fill="#475569"
        listening={false}
      />
    </>
  );
}
