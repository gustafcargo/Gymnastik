import { Circle, Group, Line, Rect } from "react-konva";
import type { EquipmentDetail } from "../../types";

type Props = {
  detail?: EquipmentDetail;
  widthPx: number;
  heightPx: number;
};

/**
 * Ritar igenkännliga silhuetter ovanpå grundformen så att varje redskap blir
 * tydligt identifierbart.
 */
export function EquipmentDetailOverlay({ detail, widthPx, heightPx }: Props) {
  if (!detail) return null;
  const strokeThin = Math.max(1, Math.min(widthPx, heightPx) * 0.04);

  switch (detail.kind) {
    case "parallel-bars":
      return (
        <Group listening={false}>
          <Line
            points={[
              widthPx * 0.05,
              heightPx * 0.3,
              widthPx * 0.95,
              heightPx * 0.3,
            ]}
            stroke="#5C2E0A"
            strokeWidth={strokeThin * 1.3}
            lineCap="round"
          />
          <Line
            points={[
              widthPx * 0.05,
              heightPx * 0.7,
              widthPx * 0.95,
              heightPx * 0.7,
            ]}
            stroke="#5C2E0A"
            strokeWidth={strokeThin * 1.3}
            lineCap="round"
          />
        </Group>
      );
    case "high-bar":
      return (
        <Line
          listening={false}
          points={[
            widthPx * 0.03,
            heightPx * 0.5,
            widthPx * 0.97,
            heightPx * 0.5,
          ]}
          stroke="#3F2C1A"
          strokeWidth={strokeThin * 1.5}
          lineCap="round"
        />
      );
    case "beam":
      return (
        <Rect
          listening={false}
          x={widthPx * 0.02}
          y={heightPx * 0.35}
          width={widthPx * 0.96}
          height={heightPx * 0.3}
          cornerRadius={heightPx * 0.15}
          fill="#F1D9A5"
          stroke="#7A5A2E"
          strokeWidth={strokeThin}
        />
      );
    case "pommel-horse":
      return (
        <Group listening={false}>
          <Line
            points={[
              widthPx * 0.3,
              heightPx * 0.2,
              widthPx * 0.3,
              heightPx * 0.5,
              widthPx * 0.4,
              heightPx * 0.5,
              widthPx * 0.4,
              heightPx * 0.2,
            ]}
            stroke="#4B3A1E"
            strokeWidth={strokeThin}
            lineJoin="round"
          />
          <Line
            points={[
              widthPx * 0.6,
              heightPx * 0.2,
              widthPx * 0.6,
              heightPx * 0.5,
              widthPx * 0.7,
              heightPx * 0.5,
              widthPx * 0.7,
              heightPx * 0.2,
            ]}
            stroke="#4B3A1E"
            strokeWidth={strokeThin}
            lineJoin="round"
          />
        </Group>
      );
    case "rings": {
      const r = Math.min(widthPx, heightPx) * 0.32;
      return (
        <Group listening={false}>
          <Circle
            x={widthPx * 0.35}
            y={heightPx * 0.55}
            radius={r}
            stroke="#2E1C00"
            strokeWidth={strokeThin * 1.2}
          />
          <Circle
            x={widthPx * 0.65}
            y={heightPx * 0.55}
            radius={r}
            stroke="#2E1C00"
            strokeWidth={strokeThin * 1.2}
          />
        </Group>
      );
    }
    case "vault":
      return (
        <Rect
          listening={false}
          x={widthPx * 0.1}
          y={heightPx * 0.25}
          width={widthPx * 0.8}
          height={heightPx * 0.5}
          cornerRadius={heightPx * 0.25}
          fill="rgba(255,255,255,0.35)"
          stroke="#6B4A1A"
          strokeWidth={strokeThin}
        />
      );
    case "trampette":
    case "mini-tramp": {
      // Diagonala studsfjäder-linjer
      const lines = [];
      const step = widthPx / 8;
      for (let i = 1; i < 8; i++) {
        lines.push(
          <Line
            key={i}
            points={[i * step, heightPx * 0.15, i * step, heightPx * 0.85]}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={strokeThin * 0.8}
          />,
        );
      }
      return <Group listening={false}>{lines}</Group>;
    }
    case "tumbling-track":
    case "air-track":
      return (
        <Group listening={false}>
          <Line
            points={[
              widthPx * 0.02,
              heightPx * 0.5,
              widthPx * 0.98,
              heightPx * 0.5,
            ]}
            stroke="rgba(0,0,0,0.25)"
            dash={[8, 6]}
            strokeWidth={strokeThin * 0.8}
          />
        </Group>
      );
    case "floor":
      return (
        <Rect
          listening={false}
          x={widthPx * 0.05}
          y={heightPx * 0.05}
          width={widthPx * 0.9}
          height={heightPx * 0.9}
          stroke="rgba(0,0,0,0.25)"
          dash={[6, 6]}
          strokeWidth={strokeThin * 0.9}
        />
      );
    case "thick-mat":
    case "landing-mat":
      return (
        <Group listening={false}>
          <Line
            points={[
              widthPx * 0.1,
              heightPx * 0.25,
              widthPx * 0.9,
              heightPx * 0.25,
            ]}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={strokeThin * 0.8}
          />
          <Line
            points={[
              widthPx * 0.1,
              heightPx * 0.5,
              widthPx * 0.9,
              heightPx * 0.5,
            ]}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={strokeThin * 0.8}
          />
          <Line
            points={[
              widthPx * 0.1,
              heightPx * 0.75,
              widthPx * 0.9,
              heightPx * 0.75,
            ]}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={strokeThin * 0.8}
          />
        </Group>
      );
    case "plinth":
    case "buck":
      return (
        <Group listening={false}>
          <Line
            points={[
              widthPx * 0.05,
              heightPx * 0.3,
              widthPx * 0.95,
              heightPx * 0.3,
            ]}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={strokeThin * 0.8}
          />
          <Line
            points={[
              widthPx * 0.05,
              heightPx * 0.6,
              widthPx * 0.95,
              heightPx * 0.6,
            ]}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={strokeThin * 0.8}
          />
        </Group>
      );
    case "foam-pit":
      return (
        <Group listening={false}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Circle
              key={i}
              x={(i % 4) * (widthPx / 4) + widthPx / 8}
              y={Math.floor(i / 4) * (heightPx / 2) + heightPx / 4}
              radius={Math.min(widthPx, heightPx) * 0.08}
              fill="rgba(255,255,255,0.4)"
            />
          ))}
        </Group>
      );
    default:
      return null;
  }
}
