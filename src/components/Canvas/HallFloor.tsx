import { Group, Line, Rect, Text } from "react-konva";
import type { HallTemplate } from "../../types";
import { usePlanStore } from "../../store/usePlanStore";

type Props = {
  hall: HallTemplate;
  pxPerM: number;
};

/**
 * Ritar hallgolvet med rutnät (1 m minor, 5 m major) och måttlabels.
 * Färgschema matchar 3D-vyns kall-blå-grå golv.
 */
export function HallFloor({ hall, pxPerM }: Props) {
  const showGrid = usePlanStore((s) => s.snapToGrid);
  const wPx = hall.widthM * pxPerM;
  const hPx = hall.heightM * pxPerM;

  const minorLines: React.ReactElement[] = [];
  const majorLines: React.ReactElement[] = [];
  const labels: React.ReactElement[] = [];

  for (let m = 0; m <= hall.widthM; m += 1) {
    const x = m * pxPerM;
    const isMajor = m % 5 === 0;
    (isMajor ? majorLines : minorLines).push(
      <Line
        key={`vx-${m}`}
        points={[x, 0, x, hPx]}
        stroke={isMajor ? "#4E5F6E" : "#637585"}
        strokeWidth={isMajor ? 0.8 : 0.4}
        opacity={isMajor ? 0.65 : 0.35}
      />,
    );
    if (isMajor && m > 0 && m < hall.widthM) {
      labels.push(
        <Text
          key={`lx-${m}`}
          x={x - 10}
          y={-18}
          text={`${m} m`}
          fontSize={10}
          fill="#8AABB8"
        />,
      );
    }
  }
  for (let m = 0; m <= hall.heightM; m += 1) {
    const y = m * pxPerM;
    const isMajor = m % 5 === 0;
    (isMajor ? majorLines : minorLines).push(
      <Line
        key={`hy-${m}`}
        points={[0, y, wPx, y]}
        stroke={isMajor ? "#4E5F6E" : "#637585"}
        strokeWidth={isMajor ? 0.8 : 0.4}
        opacity={isMajor ? 0.65 : 0.35}
      />,
    );
    if (isMajor && m > 0 && m < hall.heightM) {
      labels.push(
        <Text
          key={`ly-${m}`}
          x={-24}
          y={y - 6}
          text={`${m}`}
          fontSize={10}
          fill="#8AABB8"
        />,
      );
    }
  }

  return (
    <Group>
      {/* Golv – kall blå-grå, matchar 3D-golvet */}
      <Rect
        x={0}
        y={0}
        width={wPx}
        height={hPx}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: wPx, y: hPx }}
        fillLinearGradientColorStops={[0, "#8C9EAE", 1, "#6A7D8E"]}
        cornerRadius={4}
        shadowColor="#0F172A"
        shadowOpacity={0.15}
        shadowBlur={18}
        shadowOffsetY={6}
      />
      {/* Rutnät */}
      {showGrid && minorLines}
      {showGrid && majorLines}
      {/* Kanter */}
      <Rect
        x={0}
        y={0}
        width={wPx}
        height={hPx}
        stroke="#3A4B58"
        strokeWidth={1.5}
        listening={false}
        cornerRadius={4}
      />
      {labels}
    </Group>
  );
}
