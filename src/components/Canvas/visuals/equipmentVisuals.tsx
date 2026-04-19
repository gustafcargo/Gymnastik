import { Circle, Group, Line, Rect } from "react-konva";
import type { EquipmentType } from "../../../types";
import { MatVisual, RingsVisual, WoodVisual } from "./primitives";
import {
  FILL_BARS,
  FILL_BEAM,
  FILL_BENCH,
  FILL_FLOOR,
  FILL_MAT_AIR,
  FILL_MAT_LANDING,
  FILL_MAT_THICK,
  FILL_MAT_TUMBLING,
  FILL_PH,
  FILL_PIT,
  FILL_PLINTH,
  FILL_RINGS,
  FILL_ROPE,
  FILL_TRAMP,
  FILL_VAULT,
  FILL_WALLBARS,
  INK,
  INK_SOFT,
  strokeFor,
} from "./designTokens";

type Props = {
  type: EquipmentType;
  w: number;
  h: number;
  selected: boolean;
  colorOverride?: string;
};

type VisualProps = { w: number; h: number; selected: boolean; color?: string };

export function renderEquipment({ type, w, h, selected, colorOverride }: Props) {
  const kind = type.detail?.kind;
  const c = colorOverride;
  switch (kind) {
    case "parallel-bars":
      return <Bars w={w} h={h} selected={selected} color={c} />;
    case "uneven-bars":
      return <UnevenBars w={w} h={h} selected={selected} color={c} />;
    case "high-bar":
      return <HighBar w={w} h={h} selected={selected} color={c} />;
    case "beam":
      return <BeamVisual w={w} h={h} selected={selected} color={c} />;
    case "pommel-horse":
      return <PommelHorse w={w} h={h} selected={selected} color={c} />;
    case "rings":
      return <RingsVisual w={w} h={h} selected={selected} />;
    case "vault":
      return <Vault w={w} h={h} selected={selected} color={c} />;
    case "trampette":
    case "mini-tramp":
      return (
        <Trampette
          w={w}
          h={h}
          selected={selected}
          small={kind === "mini-tramp"}
          color={c}
        />
      );
    case "tumbling-track":
      return <MatVisual w={w} h={h} selected={selected} base={c ?? FILL_MAT_TUMBLING} />;
    case "air-track":
      return <MatVisual w={w} h={h} selected={selected} base={c ?? FILL_MAT_AIR} />;
    case "floor":
      return <Floor w={w} h={h} selected={selected} color={c} />;
    case "thick-mat":
      return <MatVisual w={w} h={h} selected={selected} base={c ?? FILL_MAT_THICK} />;
    case "landing-mat":
      return <MatVisual w={w} h={h} selected={selected} base={c ?? FILL_MAT_LANDING} />;
    case "plinth":
      return <Plinth w={w} h={h} selected={selected} color={c} />;
    case "buck":
      return <WoodVisual w={w} h={h} selected={selected} base={c ?? FILL_PLINTH} />;
    case "foam-pit":
      return <FoamPit w={w} h={h} selected={selected} color={c} />;
    case "gym-bench":
      return <GymBench w={w} h={h} selected={selected} color={c} />;
    case "wall-bars":
      return <WallBars w={w} h={h} selected={selected} color={c} />;
    case "climbing-rope":
      return <ClimbingRope w={w} h={h} selected={selected} color={c} />;
    case "rings-free":
      return <RingsFreeVisual w={w} h={h} selected={selected} />;
    default:
      return (
        <Rect
          width={w}
          height={h}
          cornerRadius={6}
          fill={c ?? type.color}
          {...strokeFor(selected)}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Parallel-bars: pastellfält + två parallella räck-linjer + 4 postcirklar
// ---------------------------------------------------------------------------
function Bars({ w, h, selected, color }: VisualProps) {
  const r = Math.min(8, Math.min(w, h) * 0.1);
  const postR = Math.max(2, Math.min(w, h) * 0.04);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_BARS}
        {...strokeFor(selected)}
      />
      {[0.28, 0.72].map((fy, i) => (
        <Line
          key={i}
          points={[w * 0.08, h * fy, w * 0.92, h * fy]}
          stroke={INK_SOFT}
          strokeWidth={0.8}
          listening={false}
        />
      ))}
      {[0.08, 0.92].flatMap((fx) =>
        [0.28, 0.72].map((fy) => (
          <Circle
            key={`${fx}-${fy}`}
            x={w * fx}
            y={h * fy}
            radius={postR}
            fill={INK}
            listening={false}
          />
        )),
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Uneven bars: två räck på olika djup (hi bak, lo fram)
// ---------------------------------------------------------------------------
function UnevenBars({ w, h, selected, color }: VisualProps) {
  const r = Math.min(8, Math.min(w, h) * 0.08);
  const postR = Math.max(2, Math.min(w, h) * 0.04);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_BARS}
        {...strokeFor(selected)}
      />
      {/* Hög räck (bakre) */}
      <Line points={[w * 0.08, h * 0.30, w * 0.92, h * 0.30]} stroke={INK_SOFT} strokeWidth={0.9} listening={false} />
      {/* Låg räck (främre) – smal streck-variant för visuell åtskillnad */}
      <Line points={[w * 0.08, h * 0.65, w * 0.92, h * 0.65]} stroke={INK_SOFT} strokeWidth={0.7} dash={[4, 2]} listening={false} />
      {[0.08, 0.92].flatMap((fx) =>
        [0.10, 0.90].map((fy) => (
          <Circle
            key={`${fx}-${fy}`}
            x={w * fx}
            y={h * fy}
            radius={postR}
            fill={INK}
            listening={false}
          />
        )),
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// High bar: smal rect + en centrerad räck-linje + två postcirklar
// ---------------------------------------------------------------------------
function HighBar({ w, h, selected, color }: VisualProps) {
  const r = Math.min(8, Math.min(w, h) * 0.1);
  const postR = Math.max(2.5, Math.min(w, h) * 0.05);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_BARS}
        {...strokeFor(selected)}
      />
      <Line
        points={[w * 0.06, h * 0.5, w * 0.94, h * 0.5]}
        stroke={INK_SOFT}
        strokeWidth={0.9}
        listening={false}
      />
      {[0.06, 0.94].map((fx) => (
        <Circle
          key={fx}
          x={w * fx}
          y={h * 0.5}
          radius={postR}
          fill={INK}
          listening={false}
        />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Pommel horse: rounded rect + två filled cirklar för handtagen
// ---------------------------------------------------------------------------
function PommelHorse({ w, h, selected, color }: VisualProps) {
  const r = Math.min(h * 0.45, w * 0.2);
  const handleR = Math.max(3, Math.min(w, h) * 0.09);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_PH}
        {...strokeFor(selected)}
      />
      {[0.32, 0.68].map((fx) => (
        <Circle
          key={fx}
          x={w * fx}
          y={h * 0.5}
          radius={handleR}
          fill={INK_SOFT}
          listening={false}
        />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Vault (hoppbord): stadium / pill shape + liten cirkel för stolpen
// ---------------------------------------------------------------------------
function Vault({ w, h, selected, color }: VisualProps) {
  const r = Math.min(w, h) * 0.42;
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_VAULT}
        {...strokeFor(selected)}
      />
      <Circle
        x={w * 0.5}
        y={h * 0.5}
        radius={Math.min(w, h) * 0.11}
        fill={INK_SOFT}
        opacity={0.55}
        listening={false}
      />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Trampette + mini-tramp: rounded rect + streckad inre + hörncirklar
// ---------------------------------------------------------------------------
function Trampette({ w, h, selected, small, color }: VisualProps & { small: boolean }) {
  const r = Math.min(8, Math.min(w, h) * 0.14);
  const inset = Math.max(3, Math.min(w, h) * (small ? 0.12 : 0.10));
  const legR = Math.max(2, Math.min(w, h) * 0.045);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_TRAMP}
        {...strokeFor(selected)}
      />
      {w > inset * 2 + 4 && h > inset * 2 + 4 && (
        <Rect
          x={inset}
          y={inset}
          width={w - inset * 2}
          height={h - inset * 2}
          cornerRadius={Math.max(0, r - 2)}
          stroke={INK_SOFT}
          strokeWidth={0.5}
          dash={[3, 3]}
          fill="transparent"
          listening={false}
        />
      )}
      {/* Hörnben */}
      {[
        [inset * 0.9, inset * 0.9],
        [w - inset * 0.9, inset * 0.9],
        [inset * 0.9, h - inset * 0.9],
        [w - inset * 0.9, h - inset * 0.9],
      ].map(([cx, cy], i) => (
        <Circle key={i} x={cx} y={cy} radius={legR} fill={INK} listening={false} />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Floor (fristående-golv): rounded rect + inre streckad tävlingsyta
// ---------------------------------------------------------------------------
function Floor({ w, h, selected, color }: VisualProps) {
  const r = Math.min(w, h) * 0.03;
  const inset = Math.min(w, h) * 0.08;
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_FLOOR}
        {...strokeFor(selected)}
      />
      {w > inset * 2 + 6 && h > inset * 2 + 6 && (
        <Rect
          x={inset}
          y={inset}
          width={w - inset * 2}
          height={h - inset * 2}
          stroke={INK_SOFT}
          strokeWidth={0.4}
          dash={[3, 3]}
          fill="transparent"
          listening={false}
        />
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Bom (beam): avlång stadium + centerremsa + T-fötter i ändarna
// ---------------------------------------------------------------------------
function BeamVisual({ w, h, selected, color }: VisualProps) {
  const r = Math.min(h * 0.45, 6);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_BEAM}
        {...strokeFor(selected)}
      />
      {/* Centrerad skyddsstrip */}
      <Line
        points={[w * 0.04, h * 0.5, w * 0.96, h * 0.5]}
        stroke={INK_SOFT}
        strokeWidth={0.5}
        listening={false}
      />
      {/* T-fötter i ändarna */}
      {[0.12, 0.88].map((fx) => (
        <Rect
          key={fx}
          x={w * fx - Math.max(1, w * 0.012)}
          y={h * 0.08}
          width={Math.max(2, w * 0.024)}
          height={h * 0.84}
          cornerRadius={1}
          fill={INK}
          opacity={0.75}
          listening={false}
        />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Plint: rounded rect + 3 horisontella tunna linjer (plint-ringar)
// ---------------------------------------------------------------------------
function Plinth({ w, h, selected, color }: VisualProps) {
  const r = Math.min(w, h) * 0.08;
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_PLINTH}
        {...strokeFor(selected)}
      />
      {[0.28, 0.5, 0.72].map((fy, i) => (
        <Line
          key={i}
          points={[w * 0.12, h * fy, w * 0.88, h * fy]}
          stroke={INK_SOFT}
          strokeWidth={0.4}
          opacity={0.6}
          listening={false}
        />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Foam pit (hoppgrop): rounded rect + dashed inner + sparsam diagonalhatch
// ---------------------------------------------------------------------------
function FoamPit({ w, h, selected, color }: VisualProps) {
  const r = Math.min(w, h) * 0.05;
  const inset = Math.min(6, Math.min(w, h) * 0.06);
  // 5 diagonala linjer med samma lutning
  const hatchCount = Math.max(4, Math.round(Math.min(w, h) / 24));
  const hatchStep = (w + h) / (hatchCount + 1);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_PIT}
        {...strokeFor(selected)}
      />
      {/* Diagonalhatch klippt till rektangeln */}
      <Group
        clipFunc={(ctx) => {
          ctx.beginPath();
          ctx.rect(inset, inset, w - inset * 2, h - inset * 2);
          ctx.closePath();
        }}
      >
        {Array.from({ length: hatchCount }).map((_, i) => {
          const d = (i + 1) * hatchStep;
          return (
            <Line
              key={i}
              points={[d, 0, 0, d]}
              stroke={INK_SOFT}
              strokeWidth={0.4}
              opacity={0.25}
              listening={false}
            />
          );
        })}
      </Group>
      {w > inset * 2 + 4 && h > inset * 2 + 4 && (
        <Rect
          x={inset}
          y={inset}
          width={w - inset * 2}
          height={h - inset * 2}
          cornerRadius={Math.max(0, r - 1)}
          stroke={INK_SOFT}
          strokeWidth={0.5}
          dash={[3, 3]}
          fill="transparent"
          listening={false}
        />
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Gym bench: avlång pill + två små postcirklar i ändarna
// ---------------------------------------------------------------------------
function GymBench({ w, h, selected, color }: VisualProps) {
  const r = Math.min(h * 0.45, 6);
  const legR = Math.max(2, Math.min(w, h) * 0.1);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? FILL_BENCH}
        {...strokeFor(selected)}
      />
      {[0.1, 0.9].map((fx) => (
        <Circle
          key={fx}
          x={w * fx}
          y={h * 0.5}
          radius={legR}
          fill={INK}
          opacity={0.7}
          listening={false}
        />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Wall-bars (ribbstol): rect + 3 parallella horisontella linjer
// ---------------------------------------------------------------------------
function WallBars({ w, h, selected, color }: VisualProps) {
  const barCount = Math.max(3, Math.round(h / 10));
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={3}
        fill={color ?? FILL_WALLBARS}
        {...strokeFor(selected)}
      />
      {Array.from({ length: barCount }).map((_, i) => {
        const y = (h / (barCount + 1)) * (i + 1);
        return (
          <Line
            key={i}
            points={[w * 0.06, y, w * 0.94, y]}
            stroke={INK_SOFT}
            strokeWidth={0.5}
            listening={false}
          />
        );
      })}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Climbing rope: cirkel + kors i mitten
// ---------------------------------------------------------------------------
function ClimbingRope({ w, h, selected, color }: VisualProps) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 1;
  return (
    <Group>
      <Circle
        x={cx}
        y={cy}
        radius={r}
        fill={color ?? FILL_ROPE}
        {...strokeFor(selected)}
      />
      <Line points={[cx - r * 0.35, cy, cx + r * 0.35, cy]} stroke={INK_SOFT} strokeWidth={0.5} listening={false} />
      <Line points={[cx, cy - r * 0.35, cx, cy + r * 0.35]} stroke={INK_SOFT} strokeWidth={0.5} listening={false} />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Rings-free: bounding rect + två cirklar (som ringar)
// ---------------------------------------------------------------------------
function RingsFreeVisual({ w, h, selected }: { w: number; h: number; selected: boolean }) {
  const ringR = Math.min(w, h) * 0.16;
  const cx = w / 2;
  const cy = h / 2;
  const sep = Math.min(w * 0.26, h * 0.26);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={Math.min(w, h) * 0.08}
        fill={FILL_RINGS}
        {...strokeFor(selected)}
      />
      {[cx - sep, cx + sep].map((rx) => (
        <Circle
          key={rx}
          x={rx}
          y={cy}
          radius={ringR}
          fill={INK_SOFT}
          listening={false}
        />
      ))}
    </Group>
  );
}
