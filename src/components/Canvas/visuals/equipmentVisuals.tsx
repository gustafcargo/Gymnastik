import { Circle, Group, Line, Rect } from "react-konva";
import type { EquipmentType } from "../../../types";
import { MatVisual, RingsVisual, WoodVisual, lighten, darken } from "./primitives";

type Props = {
  type: EquipmentType;
  w: number;
  h: number;
  selected: boolean;
  colorOverride?: string;
};

const sel = (s: boolean) => (s ? "#0B3FA8" : "#1F2937");
const SHADOW = (s: boolean) => ({
  shadowColor: "#0F172A",
  shadowBlur: s ? 16 : 8,
  shadowOpacity: s ? 0.4 : 0.22,
  shadowOffsetY: 4,
});

export function renderEquipment({ type, w, h, selected, colorOverride }: Props) {
  const kind = type.detail?.kind;
  const c = colorOverride;
  switch (kind) {
    case "parallel-bars":
      return <Bars w={w} h={h} selected={selected} color={c} />;
    case "high-bar":
      return <HighBar w={w} h={h} selected={selected} color={c} />;
    case "beam":
      return <WoodVisual w={w} h={h} selected={selected} base={c ?? "#B5894F"} feltStripe />;
    case "pommel-horse":
      return <PommelHorse w={w} h={h} selected={selected} color={c} />;
    case "rings":
      return <RingsVisual w={w} h={h} selected={selected} />;
    case "vault":
      return <Vault w={w} h={h} selected={selected} color={c} />;
    case "trampette":
    case "mini-tramp":
      return <Trampette w={w} h={h} selected={selected} small={kind === "mini-tramp"} color={c} />;
    case "tumbling-track":
      return (
        <MatVisual
          w={w}
          h={h}
          selected={selected}
          base={c ?? "#5A8C4A"}
          light={c ? lighten(c, 0.22) : "#8DBE7C"}
          dark={c ? darken(c, 0.22) : "#3F6A33"}
          stitch={c ? lighten(c, 0.45) : "#C2E1B4"}
        />
      );
    case "air-track":
      return <AirTrack w={w} h={h} selected={selected} color={c} />;
    case "floor":
      return <Floor w={w} h={h} selected={selected} color={c} />;
    case "thick-mat":
      return (
        <MatVisual
          w={w}
          h={h}
          selected={selected}
          base={c ?? "#4F86C7"}
          light={c ? lighten(c, 0.22) : "#7BA9DC"}
          dark={c ? darken(c, 0.22) : "#2F5A8E"}
        />
      );
    case "landing-mat":
      return (
        <MatVisual
          w={w}
          h={h}
          selected={selected}
          base={c ?? "#D48850"}
          light={c ? lighten(c, 0.22) : "#E8AB7C"}
          dark={c ? darken(c, 0.22) : "#9A5A2E"}
          stitch={c ? lighten(c, 0.45) : "#F2C9A6"}
        />
      );
    case "plinth":
      return <Plinth w={w} h={h} selected={selected} color={c} />;
    case "buck":
      return <WoodVisual w={w} h={h} selected={selected} base={c ?? "#A47551"} />;
    case "foam-pit":
      return <FoamPit w={w} h={h} selected={selected} color={c} />;
    default:
      return (
        <Rect
          width={w}
          height={h}
          cornerRadius={6}
          fill={c ?? type.color}
          stroke={sel(selected)}
          strokeWidth={selected ? 2 : 1}
          {...SHADOW(selected)}
        />
      );
  }
}

function Bars({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(8, Math.min(w, h) * 0.1);
  const barH = Math.max(3, h * 0.12);
  const barY1 = h * 0.28 - barH / 2;
  const barY2 = h * 0.72 - barH / 2;
  return (
    <Group>
      {/* Frame/skugga */}
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? "#EAD9B8"}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {/* Ben-skuggor */}
      {[0.08, 0.92].flatMap((fx) =>
        [0.18, 0.82].map((fy) => (
          <Circle
            key={`${fx}-${fy}`}
            x={w * fx}
            y={h * fy}
            radius={Math.min(w, h) * 0.04}
            fill="#5C4A2E"
            opacity={0.45}
          />
        )),
      )}
      {/* Två trä-räcken */}
      {[barY1, barY2].map((y, i) => (
        <Group key={i}>
          <Rect
            x={w * 0.06}
            y={y + barH * 0.55}
            width={w * 0.88}
            height={barH * 0.7}
            cornerRadius={barH * 0.35}
            fill="#000"
            opacity={0.25}
          />
          <Rect
            x={w * 0.06}
            y={y}
            width={w * 0.88}
            height={barH}
            cornerRadius={barH * 0.5}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: barH }}
            fillLinearGradientColorStops={[0, "#D8A36A", 0.5, "#A0703F", 1, "#6E4A22"]}
            stroke="#3A2614"
            strokeWidth={0.6}
          />
        </Group>
      ))}
    </Group>
  );
}

function HighBar({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(8, Math.min(w, h) * 0.1);
  const postW = Math.max(4, w * 0.06);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? "#E1E5EB"}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {/* Vajrar */}
      <Line points={[w * 0.5, h * 0.5, w * 0.05, h * 0.05]} stroke="#6B7280" strokeWidth={0.6} dash={[3, 3]} />
      <Line points={[w * 0.5, h * 0.5, w * 0.95, h * 0.05]} stroke="#6B7280" strokeWidth={0.6} dash={[3, 3]} />
      <Line points={[w * 0.5, h * 0.5, w * 0.05, h * 0.95]} stroke="#6B7280" strokeWidth={0.6} dash={[3, 3]} />
      <Line points={[w * 0.5, h * 0.5, w * 0.95, h * 0.95]} stroke="#6B7280" strokeWidth={0.6} dash={[3, 3]} />
      {/* Två stolp-fötter */}
      {[0.05, 0.95 - postW / w].map((fx, i) => (
        <Rect
          key={i}
          x={w * fx}
          y={h * 0.4}
          width={postW}
          height={h * 0.2}
          cornerRadius={postW * 0.4}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: postW, y: 0 }}
          fillLinearGradientColorStops={[0, "#B8C2CE", 0.5, "#E8EDF3", 1, "#8E9AA6"]}
          stroke="#4B5563"
          strokeWidth={0.6}
        />
      ))}
      {/* Stång */}
      <Rect
        x={w * 0.05}
        y={h * 0.49}
        width={w * 0.9}
        height={Math.max(2, h * 0.04)}
        cornerRadius={2}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: 4 }}
        fillLinearGradientColorStops={[0, "#F0F2F5", 1, "#7A8593"]}
        stroke="#2F3743"
        strokeWidth={0.5}
        shadowColor="#000"
        shadowBlur={3}
        shadowOpacity={0.4}
        shadowOffsetY={1.5}
      />
    </Group>
  );
}

function PommelHorse({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(h * 0.45, w * 0.2);
  const base = color ?? "#8B6B4F";
  return (
    <Group>
      <Rect
        x={2}
        y={4}
        width={w - 4}
        height={h - 4}
        cornerRadius={r}
        fill="#000"
        opacity={0.22}
      />
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, lighten(base, 0.22), 0.5, base, 1, darken(base, 0.28)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Stitch line */}
      <Line points={[w * 0.06, h * 0.5, w * 0.94, h * 0.5]} stroke="#3A2614" strokeWidth={0.4} dash={[3, 2]} opacity={0.5} />
      {/* Två byglar */}
      {[0.32, 0.68].map((fx, i) => (
        <Group key={i}>
          <Circle x={w * fx} y={h * 0.5} radius={Math.min(w, h) * 0.08} fill="#000" opacity={0.3} />
          <Circle
            x={w * fx}
            y={h * 0.5 - 1}
            radius={Math.min(w, h) * 0.08}
            fillRadialGradientStartPoint={{ x: -2, y: -2 }}
            fillRadialGradientEndPoint={{ x: 0, y: 0 }}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndRadius={Math.min(w, h) * 0.08}
            fillRadialGradientColorStops={[0, "#E8D8B6", 1, "#9A7A4E"]}
            stroke="#3A2614"
            strokeWidth={0.5}
          />
        </Group>
      ))}
    </Group>
  );
}

function Vault({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(w, h) * 0.4;
  const base = color ?? "#8F5C3D";
  return (
    <Group>
      <Rect
        x={2}
        y={4}
        width={w - 4}
        height={h - 4}
        cornerRadius={r}
        fill="#000"
        opacity={0.22}
      />
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, lighten(base, 0.22), 0.5, base, 1, darken(base, 0.28)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Stitch grid */}
      {[0.3, 0.5, 0.7].map((fy) => (
        <Line
          key={fy}
          points={[w * 0.1, h * fy, w * 0.9, h * fy]}
          stroke="#3A2010"
          strokeWidth={0.4}
          dash={[2, 3]}
          opacity={0.55}
        />
      ))}
      {/* Topp-highlight */}
      <Rect
        x={4}
        y={4}
        width={w - 8}
        height={h * 0.2}
        cornerRadius={r * 0.6}
        fill="#FFF"
        opacity={0.25}
      />
    </Group>
  );
}

function Trampette({ w, h, selected, small, color }: { w: number; h: number; selected: boolean; small: boolean; color?: string }) {
  const r = Math.min(8, Math.min(w, h) * 0.1);
  const inset = Math.min(w, h) * (small ? 0.14 : 0.18);
  const bedColor = color ?? "#DC2626";
  return (
    <Group>
      {/* Mörk ram */}
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, "#3F4757", 1, "#1A1F2A"]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Studsmatta */}
      <Rect
        x={inset}
        y={inset}
        width={w - inset * 2}
        height={h - inset * 2}
        cornerRadius={r * 0.5}
        fillRadialGradientStartPoint={{ x: (w - inset * 2) / 2, y: (h - inset * 2) / 2 }}
        fillRadialGradientEndPoint={{ x: (w - inset * 2) / 2, y: (h - inset * 2) / 2 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndRadius={Math.max(w, h) * 0.6}
        fillRadialGradientColorStops={[0, lighten(bedColor, 0.3), 0.7, bedColor, 1, darken(bedColor, 0.35)]}
      />
      {/* Fjäder/bungee-mönster */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const cx = w / 2;
        const cy = h / 2;
        const ri = Math.min(w, h) / 2 - inset;
        const ro = Math.min(w, h) / 2 - inset / 2;
        return (
          <Line
            key={i}
            points={[cx + Math.cos(a) * ri, cy + Math.sin(a) * ri, cx + Math.cos(a) * ro, cy + Math.sin(a) * ro]}
            stroke="#FCA5A5"
            strokeWidth={1}
            opacity={0.7}
          />
        );
      })}
      {/* Hörnfötter */}
      {[
        [0.08, 0.08],
        [0.92, 0.08],
        [0.08, 0.92],
        [0.92, 0.92],
      ].map(([fx, fy], i) => (
        <Circle key={i} x={w * fx} y={h * fy} radius={Math.min(w, h) * 0.045} fill="#0B0F18" />
      ))}
    </Group>
  );
}

function AirTrack({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.max(0, Math.min(h * 0.45, w * 0.45));
  const ribCount = Math.max(4, Math.round(w / 24));
  const base = color ?? "#2B8AC6";
  return (
    <Group>
      <Rect
        x={2}
        y={4}
        width={w - 4}
        height={h - 4}
        cornerRadius={r}
        fill="#000"
        opacity={0.22}
      />
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, lighten(base, 0.3), 0.5, base, 1, darken(base, 0.35)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {Array.from({ length: ribCount - 1 }).map((_, i) => {
        const x = ((i + 1) * w) / ribCount;
        return (
          <Line
            key={i}
            points={[x, h * 0.12, x, h * 0.88]}
            stroke="#0E4670"
            strokeWidth={0.7}
            opacity={0.5}
          />
        );
      })}
      {/* Top highlight */}
      <Rect
        x={r}
        y={3}
        width={w - r * 2}
        height={h * 0.2}
        cornerRadius={r * 0.4}
        fill="#FFF"
        opacity={0.22}
      />
    </Group>
  );
}

function Floor({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(w, h) * 0.04;
  const base = color ?? "#A4C7A6";
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: w, y: h }}
        fillLinearGradientColorStops={[0, lighten(base, 0.22), 0.5, base, 1, darken(base, 0.22)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Inre täv-linje */}
      <Rect
        x={w * 0.06}
        y={h * 0.06}
        width={w * 0.88}
        height={h * 0.88}
        stroke="#FFF"
        strokeWidth={1.4}
        dash={[6, 4]}
        opacity={0.7}
      />
      {/* Subtila parquet-linjer */}
      {Array.from({ length: 6 }).map((_, i) => (
        <Line
          key={i}
          points={[0, h * ((i + 1) / 7), w, h * ((i + 1) / 7)]}
          stroke="#5F8B62"
          strokeWidth={0.4}
          opacity={0.18}
        />
      ))}
    </Group>
  );
}

function Plinth({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(w, h) * 0.1;
  const layers = 4;
  const base = color ?? "#B7895B";
  return (
    <Group>
      <Rect
        x={2}
        y={4}
        width={w - 4}
        height={h - 4}
        cornerRadius={r}
        fill="#000"
        opacity={0.22}
      />
      {/* Visa lager från sidan – horisontella delningslinjer */}
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[
          0,
          lighten(base, 0.2),
          0.5,
          base,
          1,
          darken(base, 0.25),
        ]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {Array.from({ length: layers - 1 }).map((_, i) => (
        <Line
          key={i}
          points={[w * 0.05, (h * (i + 1)) / layers, w * 0.95, (h * (i + 1)) / layers]}
          stroke="#3A2614"
          strokeWidth={0.7}
          opacity={0.55}
        />
      ))}
      {/* Top läder-yta */}
      <Rect
        x={3}
        y={3}
        width={w - 6}
        height={h * 0.22}
        cornerRadius={r * 0.6}
        fill="#FFF"
        opacity={0.2}
      />
    </Group>
  );
}

function FoamPit({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(w, h) * 0.05;
  const cols = Math.max(4, Math.round(w / 30));
  const rows = Math.max(3, Math.round(h / 30));
  const cellW = w / cols;
  const cellH = h / rows;
  const base = color ?? "#86C26F";
  const colors = color
    ? [lighten(base, 0.2), base, darken(base, 0.12), lighten(base, 0.1)]
    : (["#B5DBA4", "#86C26F", "#6E8C5E", "#9CCB89"] as string[]);
  const blocks = [];
  for (let r0 = 0; r0 < rows; r0++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r0 * cols + c) % colors.length;
      blocks.push(
        <Rect
          key={`${r0}-${c}`}
          x={c * cellW + 2}
          y={r0 * cellH + 2}
          width={cellW - 4}
          height={cellH - 4}
          cornerRadius={2}
          fill={colors[idx]}
          opacity={0.85}
          listening={false}
        />,
      );
    }
  }
  return (
    <Group>
      {/* Pit edge */}
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill="#3A4A2F"
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 1}
        {...SHADOW(selected)}
      />
      {/* Inre fördjupning */}
      <Rect
        x={4}
        y={4}
        width={w - 8}
        height={h - 8}
        cornerRadius={r * 0.6}
        fill="#2C3923"
      />
      <Group clipFunc={(ctx) => {
        ctx.beginPath();
        ctx.rect(4, 4, w - 8, h - 8);
        ctx.closePath();
      }}>
        {blocks}
      </Group>
    </Group>
  );
}
