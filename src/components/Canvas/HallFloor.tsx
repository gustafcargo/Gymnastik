import { Group, Line, Rect, Text } from "react-konva";
import type { HallTemplate } from "../../types";
import { usePlanStore } from "../../store/usePlanStore";
import {
  INK,
  INK_SOFT,
  INK_FAINT,
  INK_GHOST,
  LABEL_FONT_FAMILY,
  PAPER,
} from "./visuals/designTokens";

type Props = {
  hall: HallTemplate;
  pxPerM: number;
  title?: string;
};

const DIM_OFFSET = 22;
const ARROW = 6;
const TITLE_Y = -48;
const LABEL_FONT_SIZE = 11;

/**
 * Ritar hallgolvet som ett blueprint-papper med millimeter-grid och
 * kantdimensioner. Skalstock i nedre vänstra hörn hjälper läsaren att
 * kalibrera ögat vid utskrift.
 */
export function HallFloor({ hall, pxPerM, title }: Props) {
  const showGrid = usePlanStore((s) => s.snapToGrid);
  const wPx = hall.widthM * pxPerM;
  const hPx = hall.heightM * pxPerM;

  const minorLines: React.ReactElement[] = [];
  const majorLines: React.ReactElement[] = [];

  for (let m = 1; m < hall.widthM; m += 1) {
    const x = m * pxPerM;
    const isMajor = m % 5 === 0;
    (isMajor ? majorLines : minorLines).push(
      <Line
        key={`vx-${m}`}
        points={[x, 0, x, hPx]}
        stroke={isMajor ? INK_FAINT : INK_GHOST}
        strokeWidth={isMajor ? 0.6 : 0.4}
        listening={false}
      />,
    );
  }
  for (let m = 1; m < hall.heightM; m += 1) {
    const y = m * pxPerM;
    const isMajor = m % 5 === 0;
    (isMajor ? majorLines : minorLines).push(
      <Line
        key={`hy-${m}`}
        points={[0, y, wPx, y]}
        stroke={isMajor ? INK_FAINT : INK_GHOST}
        strokeWidth={isMajor ? 0.6 : 0.4}
        listening={false}
      />,
    );
  }

  // 5 m skalstock (nedre vänstra hörnet, utanför hallen)
  const scaleBarLen = 5 * pxPerM;
  const scaleBarH = 5;
  const scaleBarY = hPx + 24;

  return (
    <Group>
      {/* Papper – varm off-white, inga gradienter */}
      <Rect
        x={0}
        y={0}
        width={wPx}
        height={hPx}
        fill={PAPER}
        listening={false}
      />
      {/* Rutnät */}
      {showGrid && minorLines}
      {showGrid && majorLines}
      {/* Hallram */}
      <Rect
        x={0}
        y={0}
        width={wPx}
        height={hPx}
        stroke={INK}
        strokeWidth={0.8}
        listening={false}
      />

      {/* Passrubrik ovanför hallen */}
      {title && title.trim().length > 0 && (
        <Text
          x={0}
          y={TITLE_Y}
          width={wPx}
          align="center"
          text={title}
          fontSize={18}
          fontFamily={LABEL_FONT_FAMILY}
          fontStyle="700"
          fill={INK}
          listening={false}
        />
      )}

      {/* Kantdimension — topp (bredd) */}
      <DimensionLine
        orientation="horizontal"
        length={wPx}
        offset={-DIM_OFFSET}
        label={`${hall.widthM} m`}
      />
      {/* Kantdimension — vänster (höjd) */}
      <DimensionLine
        orientation="vertical"
        length={hPx}
        offset={-DIM_OFFSET}
        label={`${hall.heightM} m`}
      />

      {/* Skalstock 5 m, segmenterad svart/vit */}
      <Group x={0} y={scaleBarY}>
        <Rect
          x={0}
          y={0}
          width={scaleBarLen / 2}
          height={scaleBarH}
          fill={INK}
          listening={false}
        />
        <Rect
          x={scaleBarLen / 2}
          y={0}
          width={scaleBarLen / 2}
          height={scaleBarH}
          fill={PAPER}
          stroke={INK}
          strokeWidth={0.6}
          listening={false}
        />
        <Rect
          x={0}
          y={0}
          width={scaleBarLen}
          height={scaleBarH}
          stroke={INK}
          strokeWidth={0.6}
          fill="transparent"
          listening={false}
        />
        <Text
          x={-2}
          y={scaleBarH + 3}
          text="0"
          fontSize={10}
          fontFamily={LABEL_FONT_FAMILY}
          fill={INK_SOFT}
          listening={false}
        />
        <Text
          x={scaleBarLen - 12}
          y={scaleBarH + 3}
          text="5 m"
          fontSize={10}
          fontFamily={LABEL_FONT_FAMILY}
          fill={INK_SOFT}
          listening={false}
        />
      </Group>
    </Group>
  );
}

/**
 * Dimensionslinje: pil → tunn linje → pil → centrerad label.
 * För horisontell ligger linjen vid y = offset (negativ = ovanför hallen).
 * För vertikal ligger linjen vid x = offset (negativ = till vänster).
 */
function DimensionLine({
  orientation,
  length,
  offset,
  label,
}: {
  orientation: "horizontal" | "vertical";
  length: number;
  offset: number;
  label: string;
}) {
  const isH = orientation === "horizontal";
  // Linjens huvud-koordinat (axeln vinkelrätt mot hallkanten)
  const perp = offset;
  // Ändpunkter i länsriktning
  const a = 0;
  const b = length;
  const mid = length / 2;

  // Tick-rullningar vid ändpunkterna (små vinkelräta streck)
  const tick = 4;

  const linePoints = isH
    ? [a, perp, b, perp]
    : [perp, a, perp, b];

  const tickA = isH
    ? [a, perp - tick, a, perp + tick]
    : [perp - tick, a, perp + tick, a];
  const tickB = isH
    ? [b, perp - tick, b, perp + tick]
    : [perp - tick, b, perp + tick, b];

  // Pilspetsar (triangel-polygon)
  const arrowA = isH
    ? [a, perp, a + ARROW, perp - ARROW * 0.45, a + ARROW, perp + ARROW * 0.45]
    : [perp, a, perp - ARROW * 0.45, a + ARROW, perp + ARROW * 0.45, a + ARROW];
  const arrowB = isH
    ? [b, perp, b - ARROW, perp - ARROW * 0.45, b - ARROW, perp + ARROW * 0.45]
    : [perp, b, perp - ARROW * 0.45, b - ARROW, perp + ARROW * 0.45, b - ARROW];

  // Textplacering (centrerad, lite ovanför/utanför linjen)
  const labelBoxW = 60;
  const labelBoxH = 14;

  return (
    <Group listening={false}>
      <Line points={linePoints} stroke={INK_SOFT} strokeWidth={0.5} />
      <Line points={tickA} stroke={INK_SOFT} strokeWidth={0.5} />
      <Line points={tickB} stroke={INK_SOFT} strokeWidth={0.5} />
      <Line points={arrowA} stroke={INK_SOFT} strokeWidth={0.5} fill={INK_SOFT} closed />
      <Line points={arrowB} stroke={INK_SOFT} strokeWidth={0.5} fill={INK_SOFT} closed />
      {isH ? (
        <>
          {/* Bakgrund bakom texten så linjen inte går rakt igenom */}
          <Rect
            x={mid - labelBoxW / 2}
            y={perp - labelBoxH / 2}
            width={labelBoxW}
            height={labelBoxH}
            fill={PAPER}
          />
          <Text
            x={mid}
            y={perp}
            offsetX={labelBoxW / 2}
            offsetY={LABEL_FONT_SIZE / 2}
            width={labelBoxW}
            align="center"
            text={label}
            fontSize={LABEL_FONT_SIZE}
            fontFamily={LABEL_FONT_FAMILY}
            fontStyle="600"
            fill={INK_SOFT}
          />
        </>
      ) : (
        <>
          <Rect
            x={perp - labelBoxH / 2}
            y={mid - labelBoxW / 2}
            width={labelBoxH}
            height={labelBoxW}
            fill={PAPER}
          />
          <Text
            x={perp}
            y={mid}
            offsetX={labelBoxW / 2}
            offsetY={LABEL_FONT_SIZE / 2}
            width={labelBoxW}
            align="center"
            text={label}
            fontSize={LABEL_FONT_SIZE}
            fontFamily={LABEL_FONT_FAMILY}
            fontStyle="600"
            fill={INK_SOFT}
            rotation={-90}
          />
        </>
      )}
    </Group>
  );
}
