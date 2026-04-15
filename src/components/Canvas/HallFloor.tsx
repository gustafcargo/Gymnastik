import { Group, Line, Rect, Text } from "react-konva";
import type { HallTemplate } from "../../types";
import { usePlanStore } from "../../store/usePlanStore";

type Props = {
  hall: HallTemplate;
  pxPerM: number;
};

/**
 * Ritar hallgolvet med rutnät (1 m minor, 5 m major) och måttlabels.
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
        stroke={isMajor ? "#8E7B52" : "#C9B896"}
        strokeWidth={isMajor ? 0.75 : 0.4}
        opacity={isMajor ? 0.6 : 0.35}
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
          fill="#6B5E3A"
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
        stroke={isMajor ? "#8E7B52" : "#C9B896"}
        strokeWidth={isMajor ? 0.75 : 0.4}
        opacity={isMajor ? 0.6 : 0.35}
      />,
    );
    if (isMajor && m > 0 && m < hall.heightM) {
      labels.push(
        <Text
          key={`ly-${m}`}
          x={-22}
          y={y - 6}
          text={`${m}`}
          fontSize={10}
          fill="#6B5E3A"
        />,
      );
    }
  }

  return (
    <Group>
      {/* Golv – gradient via fillLinearGradient */}
      <Rect
        x={0}
        y={0}
        width={wPx}
        height={hPx}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: wPx, y: hPx }}
        fillLinearGradientColorStops={[0, "#F0D7AD", 1, "#D9B382"]}
        cornerRadius={4}
        shadowColor="#0F172A"
        shadowOpacity={0.08}
        shadowBlur={16}
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
        stroke="#6B5E3A"
        strokeWidth={1.5}
        listening={false}
        cornerRadius={4}
      />
      {labels}
    </Group>
  );
}
