import { Group, Rect, Line } from "react-konva";
import type { HallTemplate } from "../../types";
import { usePlanStore } from "../../store/usePlanStore";
import {
  INK,
  INK_FAINT,
  INK_GHOST,
  PAPER,
} from "./visuals/designTokens";

type Props = {
  hall: HallTemplate;
  pxPerM: number;
};

/**
 * Ritar hallgolvet som ett blueprint-papper med millimeter-grid.
 * Pass-rubrik och hall-mått läggs på först vid export (composeA4Page)
 * — i editorn håller vi ritytan ren så den matchar det som landar
 * innanför A4-ramen.
 */
export function HallFloor({ hall, pxPerM }: Props) {
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
    </Group>
  );
}
