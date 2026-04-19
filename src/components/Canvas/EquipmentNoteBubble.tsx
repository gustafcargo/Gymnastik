import { useRef } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { PlacedEquipment, EquipmentType } from "../../types";

type Props = {
  eq: PlacedEquipment;
  type: EquipmentType;
  pxPerM: number;
  /**
   * true när hela hallen ritas 90° roterad för att fylla containerns
   * långsida. Bubblan counter-roteras då med samma vinkel så texten
   * förblir horisontellt läsbar från skärmen.
   */
  hallRotated?: boolean;
  onOffsetChange: (offset: { x: number; y: number }) => void;
  onSizeChange?: (size: { w: number; h: number }) => void;
  onSelect?: () => void;
  onStartEdit?: () => void;
};

const DEFAULT_BUBBLE_W = 130;
const BUBBLE_PADDING = 7;
const FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const DEFAULT_MIN_LINES = 4;
const DEFAULT_BUBBLE_H = BUBBLE_PADDING * 2 + LINE_HEIGHT * DEFAULT_MIN_LINES;
const MIN_W = 15;
const MIN_H = 24;

/** Uppskatta bubblans höjd utifrån text och bredd. Räknar radbrytningar
 *  (`\n`) samt uppskattad word-wrap baserat på textbredd. */
function estimateBubbleH(text: string, widthPx: number): number {
  if (!text) return DEFAULT_BUBBLE_H;
  const innerW = Math.max(1, widthPx - BUBBLE_PADDING * 2);
  const charW = FONT_SIZE * 0.55;
  const charsPerLine = Math.max(1, Math.floor(innerW / charW));
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    const len = paragraph.length;
    lines += len === 0 ? 1 : Math.ceil(len / charsPerLine);
  }
  const needed = BUBBLE_PADDING * 2 + Math.max(DEFAULT_MIN_LINES, lines) * LINE_HEIGHT;
  return Math.max(DEFAULT_BUBBLE_H, needed);
}
// Osynlig hit-area för att kunna greppa nedre-höger hörnet. Ingen fill
// eller stroke — hörnet ska se ut som de övriga tre rundade hörnen.
const HANDLE_HIT = 14;

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
  hallRotated = false,
  onOffsetChange,
  onSizeChange,
  onSelect,
  onStartEdit,
}: Props) {
  const offset = eq.noteOffset ?? defaultOffset(type);
  const bubbleW = eq.noteSize?.w ?? DEFAULT_BUBBLE_W;
  const bubbleH = eq.noteSize?.h ?? estimateBubbleH(eq.notes ?? "", bubbleW);

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

  // Resize via nedre höger hörn. Handtaget är ett barn till bubbel-gruppen
  // (som ev. är counter-roterad), så e.target.x()/y() är i bubbel-lokalt
  // koordinatsystem: hörnet ligger initialt på (W, H) eftersom gruppens
  // offsetX/Y är W/2, H/2.
  const handleResizeDragMove = (e: KonvaEventObject<DragEvent>) => {
    const newW = Math.max(MIN_W, e.target.x());
    const newH = Math.max(MIN_H, e.target.y());
    // Snappa handtaget till klampad storlek så det inte glider i väg
    e.target.x(newW);
    e.target.y(newH);

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
    const newW = Math.max(MIN_W, e.target.x());
    const newH = Math.max(MIN_H, e.target.y());
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

      {/* Note card – draggable, centered on (bubbleCx, bubbleCy). Counter-
          roteras när hallen är 90°-roterad så att själva texten förblir
          läsbar i skärmens riktning. */}
      <Group
        ref={groupRef}
        x={bubbleCx}
        y={bubbleCy}
        offsetX={bubbleW / 2}
        offsetY={bubbleH / 2}
        rotation={hallRotated ? -90 : 0}
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
        />
        {/* Resize-handtag — osynligt men dragbart. Ligger i bubbel-lokala
            koordinater (bubblans nedre-höger hörn) så det följer med
            counter-rotationen. */}
        {onSizeChange && (
          <Circle
            ref={handleRef}
            x={bubbleW}
            y={bubbleH}
            radius={HANDLE_HIT}
            fill="transparent"
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
      </Group>
    </>
  );
}
