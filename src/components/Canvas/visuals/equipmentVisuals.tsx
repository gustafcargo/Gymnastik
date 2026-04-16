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

// ---------------------------------------------------------------------------
// Ojämna barr – top-view: two bars at different depths (high behind, low front)
// ---------------------------------------------------------------------------
function UnevenBars({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(8, Math.min(w, h) * 0.08);
  const barH = Math.max(3, h * 0.09);
  // High bar appears further back in plan view (higher Y)
  const hiY = h * 0.30 - barH / 2;
  // Low bar is closer (lower Y)
  const loY = h * 0.65 - barH / 2;
  const postR = Math.min(w, h) * 0.04;

  return (
    <Group>
      {/* Frame background */}
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={color ?? "#E4E8EE"}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {/* Floor-anchor cable stays (dashed diagonals) */}
      {[0.08, 0.92].flatMap((fx) => [
        <Line key={`h1-${fx}`} points={[w * fx, hiY, w * fx, h * 0.06]} stroke="#6B7280" strokeWidth={0.7} dash={[3, 3]} opacity={0.45} />,
        <Line key={`h2-${fx}`} points={[w * fx, hiY + barH, w * fx, h * 0.94]} stroke="#6B7280" strokeWidth={0.7} dash={[3, 3]} opacity={0.35} />,
        <Line key={`l1-${fx}`} points={[w * fx, loY, w * fx, h * 0.06]} stroke="#6B7280" strokeWidth={0.7} dash={[3, 3]} opacity={0.3} />,
        <Line key={`l2-${fx}`} points={[w * fx, loY + barH, w * fx, h * 0.94]} stroke="#6B7280" strokeWidth={0.7} dash={[3, 3]} opacity={0.4} />,
      ])}
      {/* High bar (metal – same color as 3D model) */}
      <Rect
        x={w * 0.06}
        y={hiY + barH * 0.55}
        width={w * 0.88}
        height={barH * 0.7}
        cornerRadius={barH * 0.35}
        fill="#000"
        opacity={0.22}
      />
      <Rect
        x={w * 0.06}
        y={hiY}
        width={w * 0.88}
        height={barH}
        cornerRadius={barH * 0.5}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: barH }}
        fillLinearGradientColorStops={[0, "#E0E5EC", 0.45, "#B0B8C4", 1, "#6A7585"]}
        stroke="#3F4757"
        strokeWidth={0.6}
      />
      {/* Low bar (wood-colored) */}
      <Rect
        x={w * 0.06}
        y={loY + barH * 0.55}
        width={w * 0.88}
        height={barH * 0.7}
        cornerRadius={barH * 0.35}
        fill="#000"
        opacity={0.22}
      />
      <Rect
        x={w * 0.06}
        y={loY}
        width={w * 0.88}
        height={barH}
        cornerRadius={barH * 0.5}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: barH }}
        fillLinearGradientColorStops={[0, "#D4AA7A", 0.45, "#A07840", 1, "#6A4C20"]}
        stroke="#3A2614"
        strokeWidth={0.6}
      />
      {/* 4 post circles at corners */}
      {[0.08, 0.92].flatMap((fx) =>
        [0.10, 0.90].map((fy) => (
          <Circle
            key={`${fx}-${fy}`}
            x={w * fx}
            y={h * fy}
            radius={postR}
            fill="#3E4A58"
            opacity={0.5}
          />
        )),
      )}
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

// ---------------------------------------------------------------------------
// Hoppbord/vault – top-down vy: matchar 3D-modellens stoppade yta med
// rundade kortsidor, sidosömmar och metallpelare under.
// ---------------------------------------------------------------------------
function Vault({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const padColor = color ?? "#CC4E10";   // matchar 3D bodyColor
  const topColor = color ? darken(color, 0.12) : "#B84010";
  // Rundade approach/landing-kanter (kortsidorna). Radius ≈ halva kortsidan
  // skapar en tydlig stadion-/pillform sedd uppifrån, som matchar 3D-modellen.
  const rEnd = Math.min(w, h) * 0.42;
  return (
    <Group>
      {/* Skugga */}
      <Rect x={2} y={3} width={w - 4} height={h - 3} cornerRadius={rEnd} fill="#000" opacity={0.20} />
      {/* Stoppad yta – rektangulär med rundade kortsidor (som 3D-modellen) */}
      <Rect
        width={w}
        height={h}
        cornerRadius={rEnd}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, lighten(padColor, 0.25), 0.4, padColor, 1, darken(padColor, 0.20)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Sidosömmar (vertikala remsor som på 3D-modellen) */}
      {[w * 0.04, w * 0.96].map((lx, i) => (
        <Line key={i} points={[lx, h * 0.12, lx, h * 0.88]} stroke={topColor} strokeWidth={1.2} opacity={0.6} />
      ))}
      {/* Topp-yta (mörkare läder/syntet) */}
      <Rect
        x={w * 0.06}
        y={h * 0.08}
        width={w * 0.88}
        height={h * 0.84}
        cornerRadius={rEnd * 0.6}
        fill={topColor}
        opacity={0.25}
        listening={false}
      />
      {/* Metallfot synlig under (grå cirkel i mitten) */}
      <Circle
        x={w * 0.5}
        y={h * 0.5}
        radius={Math.min(w, h) * 0.12}
        fill="#5A6270"
        opacity={0.30}
      />
      {/* Highlight */}
      {w > 8 && (
        <Rect
          x={rEnd * 0.4}
          y={3}
          width={w - rEnd * 0.8}
          height={h * 0.18}
          cornerRadius={rEnd * 0.4}
          fill="#FFF"
          opacity={0.20}
          listening={false}
        />
      )}
    </Group>
  );
}

function Trampette({ w, h, selected, small, color }: { w: number; h: number; selected: boolean; small: boolean; color?: string }) {
  const r = Math.min(6, Math.min(w, h) * 0.08);
  const frameW = Math.min(w, h) * 0.06;  // metallram-tjocklek
  const padColor = small ? (color ?? "#B02020") : (color ?? "#E06020");
  const frameColor = small ? "#3A4050" : "#2A2A2A";

  if (small) {
    // Mini-trampolin: metallram + hoppyta inuti + 4 splaya ben
    const legR = Math.min(w, h) * 0.035;
    const splay = Math.min(w, h) * 0.06;
    return (
      <Group>
        <Rect x={2} y={3} width={w - 4} height={h - 3} cornerRadius={r} fill="#000" opacity={0.18} />
        {/* Metallram */}
        <Rect width={w} height={h} cornerRadius={r}
          fill={frameColor} stroke={sel(selected)} strokeWidth={selected ? 2 : 0.9} {...SHADOW(selected)} />
        {/* Hoppyta */}
        <Rect x={frameW} y={frameW} width={w - frameW * 2} height={h - frameW * 2}
          cornerRadius={r * 0.4}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: h - frameW * 2 }}
          fillLinearGradientColorStops={[0, lighten(padColor, 0.22), 0.5, padColor, 1, darken(padColor, 0.22)]}
        />
        {/* 4 ben (sprider ut – syns som cirklar utanför ramen) */}
        {[[splay, splay], [w - splay, splay], [splay, h - splay], [w - splay, h - splay]].map(([fx, fy], i) => (
          <Circle key={i} x={fx} y={fy} radius={legR} fill="#5A6272" opacity={0.7} />
        ))}
        {/* Gummifötter */}
        {[[splay, splay], [w - splay, splay], [splay, h - splay], [w - splay, h - splay]].map(([fx, fy], i) => (
          <Circle key={`f${i}`} x={fx} y={fy} radius={legR * 0.6} fill="#C01818" opacity={0.8} />
        ))}
      </Group>
    );
  }

  // Satsbräda (trampett): rektangulär stoppyta, fjädrar synliga som linjer
  const springCount = 5;
  return (
    <Group>
      <Rect x={2} y={3} width={w - 4} height={h - 3} cornerRadius={r} fill="#000" opacity={0.18} />
      {/* Träbas (ljust trä som i 3D) */}
      <Rect width={w} height={h} cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, "#D4B878", 0.5, "#C8A060", 1, "#A08040"]}
        stroke={sel(selected)} strokeWidth={selected ? 2 : 0.9} {...SHADOW(selected)} />
      {/* Metallsidoramar */}
      <Rect x={1} y={1} width={frameW} height={h - 2} cornerRadius={1} fill={frameColor} opacity={0.7} />
      <Rect x={w - frameW - 1} y={1} width={frameW} height={h - 2} cornerRadius={1} fill={frameColor} opacity={0.7} />
      {/* Stoppyta (orange som i 3D) */}
      <Rect x={frameW + 2} y={h * 0.06} width={w - frameW * 2 - 4} height={h * 0.88}
        cornerRadius={r * 0.4}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h * 0.88 }}
        fillLinearGradientColorStops={[0, lighten(padColor, 0.28), 0.45, padColor, 1, darken(padColor, 0.22)]}
      />
      {/* Fjädrar (horisontella linjer) */}
      {Array.from({ length: springCount }).map((_, i) => {
        const sy = h * 0.12 + ((i + 0.5) / springCount) * h * 0.76;
        return (
          <Line key={i} points={[frameW + 4, sy, w - frameW - 4, sy]}
            stroke="#4A4A4A" strokeWidth={1.2} opacity={0.45} />
        );
      })}
      {/* Highlight */}
      <Rect x={frameW + 4} y={h * 0.08} width={w - frameW * 2 - 8} height={h * 0.14}
        cornerRadius={2} fill="#FFF" opacity={0.18} listening={false} />
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
  const r = Math.min(w, h) * 0.03;
  // Matchar 3D: blå ytterkant, röd inre tävlingsyta, vita linjer
  const outerColor = color ?? "#1A50C0";
  const innerColor = color ? lighten(color, 0.25) : "#CC2828";
  const border = Math.min(w, h) * 0.083;
  return (
    <Group>
      <Rect x={2} y={3} width={w - 4} height={h - 3} cornerRadius={r} fill="#000" opacity={0.18} />
      {/* Blå yttermatta */}
      <Rect
        width={w} height={h} cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: w, y: h }}
        fillLinearGradientColorStops={[0, lighten(outerColor, 0.15), 0.5, outerColor, 1, darken(outerColor, 0.15)]}
        stroke={sel(selected)} strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Röd inre tävlingsyta */}
      <Rect
        x={border} y={border} width={w - border * 2} height={h - border * 2}
        cornerRadius={r * 0.5}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: w - border * 2, y: h - border * 2 }}
        fillLinearGradientColorStops={[0, lighten(innerColor, 0.12), 0.5, innerColor, 1, darken(innerColor, 0.12)]}
      />
      {/* Vita kantlinjer */}
      <Rect
        x={border - 1} y={border - 1} width={w - border * 2 + 2} height={h - border * 2 + 2}
        stroke="#FFFFFF" strokeWidth={1.2} opacity={0.8} fill="transparent" listening={false}
      />
      {/* Centrumkors */}
      <Line points={[w * 0.42, h * 0.5, w * 0.58, h * 0.5]} stroke="#FFF" strokeWidth={0.8} opacity={0.6} />
      <Line points={[w * 0.5, h * 0.42, w * 0.5, h * 0.58]} stroke="#FFF" strokeWidth={0.8} opacity={0.6} />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Bom – top-down vy: matchar 3D med röda stöd, T-formade metallfötter,
// smal bomyta med läder/mockastrimma.
// ---------------------------------------------------------------------------
function BeamVisual({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const topColor = color ?? "#B8875A";     // matchar 3D yta
  const bodyColor = color ? darken(color, 0.30) : "#4A2810";
  const postColor = color ?? "#C82020";    // röda stöd som i 3D
  const footColor = "#7A7A8A";             // metall T-fötter

  // T-bar fötter vid varje ände
  const foot1X = w * 0.14;
  const foot2X = w * 0.86;
  const footDepth = Math.max(3, h * 0.85);
  const footW = Math.max(2, w * 0.025);
  const footY = (h - footDepth) / 2;

  // Bom-kropp: smal, centrerad
  const beamH = Math.max(3, h * 0.28);
  const beamY = (h - beamH) / 2;

  // Stödcirklar (röda pelare sett uppifrån)
  const postR = Math.min(w, h) * 0.035;

  return (
    <Group>
      <Rect x={2} y={3} width={w - 4} height={h - 2} cornerRadius={3} fill="#000" opacity={0.15} />
      {/* Ljus bakgrund för fotavtryck */}
      <Rect width={w} height={h} cornerRadius={3}
        fill={lighten(topColor, 0.60)} opacity={0.30}
        stroke={selected ? "#0B3FA8" : "#5A6270"}
        strokeWidth={selected ? 2 : 0.5}
        {...SHADOW(selected)} />

      {/* T-bar metallfötter (vinkelräta mot bommen) */}
      {[foot1X, foot2X].map((cx) => (
        <Rect key={cx} x={cx - footW / 2} y={footY} width={footW} height={footDepth}
          cornerRadius={1} fill={footColor} opacity={0.6} />
      ))}
      {/* Vita gummikuddar vid T-fotens ändar */}
      {[foot1X, foot2X].flatMap((cx) => [
        { x: cx, y: footY + footDepth * 0.06 },
        { x: cx, y: footY + footDepth * 0.94 },
      ]).map((p, i) => (
        <Rect key={`pad${i}`} x={p.x - footW * 0.8} y={p.y - Math.max(2, h * 0.05)}
          width={footW * 1.6} height={Math.max(3, h * 0.10)}
          cornerRadius={1} fill="#EEEEEE" opacity={0.7} />
      ))}
      {/* Röda stödpelare (sett uppifrån = cirklar) */}
      {[foot1X, foot2X].map((cx, i) => (
        <Circle key={`post${i}`} x={cx} y={h / 2} radius={postR}
          fillRadialGradientStartPoint={{ x: -1, y: -1 }}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndRadius={postR}
          fillRadialGradientColorStops={[0, lighten(postColor, 0.3), 0.6, postColor, 1, darken(postColor, 0.3)]}
          opacity={0.8} />
      ))}

      {/* Bom-kropp (mörk aluminiumstruktur) */}
      <Rect x={w * 0.04} y={beamY + beamH * 0.15} width={w * 0.92} height={beamH * 0.70}
        cornerRadius={Math.min(beamH * 0.3, 3)}
        fill={bodyColor} opacity={0.5} />
      {/* Läder/mocka-yta ovanpå */}
      <Rect x={w * 0.03} y={beamY} width={w * 0.94} height={beamH}
        cornerRadius={Math.min(beamH * 0.45, 4)}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: beamH }}
        fillLinearGradientColorStops={[0, lighten(topColor, 0.22), 0.35, topColor, 1, darken(topColor, 0.18)]}
        stroke={darken(bodyColor, 0.2)} strokeWidth={0.5} />
      {/* Ljus centerremsa */}
      <Rect x={w * 0.05} y={beamY + beamH * 0.12} width={w * 0.90} height={beamH * 0.35}
        cornerRadius={2} fill="#F1D9A5" opacity={0.40} listening={false} />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Plint – top-down vy: platt överdel (läderyta), inga sidovys-linjer.
// ---------------------------------------------------------------------------
function Plinth({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const r = Math.min(w, h) * 0.1;
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
      {/* Platt toppyta med diagonal gradient */}
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: w, y: h }}
        fillLinearGradientColorStops={[0, lighten(base, 0.28), 0.5, base, 1, darken(base, 0.22)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Inre kantlinje – visar plint-toppens upphöjda yta */}
      {w > 10 && h > 10 && (
        <Rect
          x={w * 0.1}
          y={h * 0.1}
          width={w * 0.8}
          height={h * 0.8}
          cornerRadius={r * 0.5}
          stroke={darken(base, 0.18)}
          strokeWidth={0.8}
          fill="transparent"
          opacity={0.55}
          listening={false}
        />
      )}
      {/* Läder-highlight i övre del */}
      {w > 6 && (
        <Rect
          x={3}
          y={3}
          width={w - 6}
          height={h * 0.22}
          cornerRadius={r * 0.6}
          fill="#FFF"
          opacity={0.18}
          listening={false}
        />
      )}
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
      {w > 8 && h > 8 && (
        <>
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
        </>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Gymnastikbänk – long plank top-view, A-frame leg marks at both short ends
// ---------------------------------------------------------------------------
function GymBench({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const base = color ?? "#C8A870";
  const legW = Math.max(4, h * 0.7);
  const legH = h;
  return (
    <Group>
      {/* Shadow */}
      <Rect x={2} y={3} width={w - 4} height={h - 2} cornerRadius={2} fill="#000" opacity={0.2} />
      {/* Plank */}
      <Rect
        width={w}
        height={h}
        cornerRadius={Math.min(h * 0.35, 5)}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, lighten(base, 0.25), 0.5, base, 1, darken(base, 0.22)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {/* Centre grain line */}
      <Line points={[w * 0.06, h * 0.5, w * 0.94, h * 0.5]} stroke={darken(base, 0.18)} strokeWidth={0.5} opacity={0.5} />
      {/* Leg marks at each end */}
      {[legW / 2, w - legW / 2].map((cx, i) => (
        <Group key={i}>
          {/* Left foot */}
          <Circle x={cx - legW * 0.22} y={h * 0.5} radius={Math.max(2, legH * 0.18)} fill={darken(base, 0.45)} opacity={0.65} />
          {/* Right foot */}
          <Circle x={cx + legW * 0.22} y={h * 0.5} radius={Math.max(2, legH * 0.18)} fill={darken(base, 0.45)} opacity={0.65} />
        </Group>
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Ribbstol (wall-bars) – top-view of horizontal bars + wall-mounting rail
// ---------------------------------------------------------------------------
function WallBars({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const base = color ?? "#C8904A";
  const barCount = Math.max(3, Math.round(h / 6));
  return (
    <Group>
      {/* Mounting rail (back, thin) */}
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        cornerRadius={3}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, lighten(base, 0.18), 0.5, base, 1, darken(base, 0.25)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {/* Horizontal rungs */}
      {Array.from({ length: barCount }).map((_, i) => {
        const y = (h / (barCount + 1)) * (i + 1);
        return (
          <Rect
            key={i}
            x={w * 0.05}
            y={y - Math.max(1, h * 0.055)}
            width={w * 0.9}
            height={Math.max(2, h * 0.11)}
            cornerRadius={1}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: h * 0.11 }}
            fillLinearGradientColorStops={[0, lighten(base, 0.35), 1, darken(base, 0.2)]}
            stroke={darken(base, 0.3)}
            strokeWidth={0.4}
          />
        );
      })}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Klätterrep – top-view shows circular rope cross-section with coil texture
// ---------------------------------------------------------------------------
function ClimbingRope({ w, h, selected, color }: { w: number; h: number; selected: boolean; color?: string }) {
  const base = color ?? "#8B6A3A";
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 1;
  return (
    <Group>
      {/* Shadow */}
      <Circle x={cx + 2} y={cy + 3} radius={r} fill="#000" opacity={0.2} />
      {/* Rope circle */}
      <Circle
        x={cx}
        y={cy}
        radius={r}
        fillRadialGradientStartPoint={{ x: -r * 0.3, y: -r * 0.3 }}
        fillRadialGradientEndPoint={{ x: 0, y: 0 }}
        fillRadialGradientStartRadius={0}
        fillRadialGradientEndRadius={r}
        fillRadialGradientColorStops={[0, lighten(base, 0.4), 0.6, base, 1, darken(base, 0.3)]}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {/* Strand pattern */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const ir = r * 0.3;
        const or = r * 0.75;
        return (
          <Line
            key={i}
            points={[cx + Math.cos(a) * ir, cy + Math.sin(a) * ir, cx + Math.cos(a) * or, cy + Math.sin(a) * or]}
            stroke={darken(base, 0.2)}
            strokeWidth={0.8}
            opacity={0.6}
          />
        );
      })}
      {/* Centre knot */}
      <Circle x={cx} y={cy} radius={r * 0.22} fill={darken(base, 0.15)} opacity={0.7} />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Ringar (fristående) – top-view of two ring circles on a narrow base
// ---------------------------------------------------------------------------
function RingsFreeVisual({ w, h, selected }: { w: number; h: number; selected: boolean }) {
  const ringR = Math.min(w, h) * 0.22;
  const cx = w / 2;
  const cy = h / 2;
  const sep = Math.min(w * 0.28, h * 0.28);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={Math.min(w, h) * 0.1}
        fill={sel(selected) === "#0B3FA8" ? "#DBEAFE" : "#E8EDF3"}
        stroke={sel(selected)}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {[cx - sep, cx + sep].map((rx, i) => (
        <Group key={i}>
          <Circle x={rx} y={cy} radius={ringR + 2} fill="#000" opacity={0.15} />
          <Circle x={rx} y={cy} radius={ringR} fill="none" stroke="#7A5C30" strokeWidth={Math.max(2, ringR * 0.3)} />
          <Circle x={rx} y={cy} radius={ringR * 0.55} fill="none" stroke="#A07840" strokeWidth={0.6} opacity={0.5} />
        </Group>
      ))}
    </Group>
  );
}
