import { Circle, Group, Line, Rect } from "react-konva";

type Props = { w: number; h: number; selected: boolean };

const SHADOW = (sel: boolean) => ({
  shadowColor: "#0F172A",
  shadowBlur: sel ? 16 : 8,
  shadowOpacity: sel ? 0.4 : 0.22,
  shadowOffsetY: 4,
});

/** Tjock matta med stoppning + steppningar. Top-down vy. */
export function MatVisual({
  w,
  h,
  selected,
  base = "#4F86C7",
  light = "#79A3D1",
  dark = "#365E94",
  stitch = "#A6C5E3",
}: Props & { base?: string; light?: string; dark?: string; stitch?: string }) {
  const r = Math.min(10, Math.min(w, h) * 0.08);
  const cols = Math.max(2, Math.round(w / 35));
  const rows = Math.max(1, Math.round(h / 35));
  const cellW = w / cols;
  const cellH = h / rows;
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, light, 0.55, base, 1, dark]}
        stroke={selected ? "#0B3FA8" : "#1F3855"}
        strokeWidth={selected ? 2 : 1}
        {...SHADOW(selected)}
      />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Line
          key={`v${i}`}
          points={[(i + 1) * cellW, 4, (i + 1) * cellW, h - 4]}
          stroke={stitch}
          strokeWidth={0.6}
          dash={[3, 3]}
          opacity={0.55}
          listening={false}
        />
      ))}
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <Line
          key={`h${i}`}
          points={[4, (i + 1) * cellH, w - 4, (i + 1) * cellH]}
          stroke={stitch}
          strokeWidth={0.6}
          dash={[3, 3]}
          opacity={0.55}
          listening={false}
        />
      ))}
      {/* Topp-highlight */}
      {w > 8 && (
        <Rect
          x={4}
          y={4}
          width={w - 8}
          height={Math.max(2, h * 0.18)}
          cornerRadius={r * 0.6}
          fill="#FFFFFF"
          opacity={0.18}
          listening={false}
        />
      )}
    </Group>
  );
}

/** Trä-redskap (bom, plint, bock, hoppbord) – varm trägradient med ljus topp. */
export function WoodVisual({
  w,
  h,
  selected,
  base,
  feltStripe,
}: Props & { base: string; feltStripe?: boolean }) {
  const r = Math.min(8, Math.min(w, h) * 0.18);
  const lighter = lighten(base, 0.18);
  const darker = darken(base, 0.22);
  return (
    <Group>
      {w > 4 && h > 4 && (
        <Rect
          x={2}
          y={3}
          width={w - 4}
          height={h - 4}
          cornerRadius={r}
          fill="#000"
          opacity={0.18}
          listening={false}
        />
      )}
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: h }}
        fillLinearGradientColorStops={[0, lighter, 0.5, base, 1, darker]}
        stroke="#3A2614"
        strokeWidth={selected ? 2 : 0.9}
        {...SHADOW(selected)}
      />
      {/* Ljus topp-yta */}
      {w > 6 && (
        <Rect
          x={3}
          y={3}
          width={w - 6}
          height={Math.max(2, h * 0.28)}
          cornerRadius={r * 0.6}
          fill="#FFFFFF"
          opacity={0.22}
          listening={false}
        />
      )}
      {/* Ådringar (tunna mörka linjer) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Line
          key={i}
          points={[w * 0.05, h * (0.35 + i * 0.16), w * 0.95, h * (0.38 + i * 0.16)]}
          stroke={darker}
          strokeWidth={0.4}
          opacity={0.4}
          listening={false}
        />
      ))}
      {feltStripe && (
        <Rect
          x={3}
          y={h * 0.4}
          width={w - 6}
          height={h * 0.2}
          fill="#F1D9A5"
          opacity={0.55}
          listening={false}
        />
      )}
    </Group>
  );
}

/** Två cirkulära ringar med metallic-stroke + cables till topp. */
export function RingsVisual({ w, h, selected }: Props) {
  const r = Math.min(w, h) * 0.22;
  const leftX = w * 0.32;
  const rightX = w * 0.68;
  const cy = h * 0.6;
  return (
    <Group>
      {/* Subtil bottenplatta */}
      <Rect
        width={w}
        height={h}
        cornerRadius={Math.min(8, h * 0.15)}
        fill="#F4E8CE"
        stroke={selected ? "#0B3FA8" : "#A8916A"}
        strokeWidth={selected ? 2 : 0.8}
        dash={selected ? undefined : [4, 4]}
        opacity={0.55}
        {...SHADOW(selected)}
      />
      {/* Kablar upp till topp-kant */}
      <Line
        points={[leftX, cy, w * 0.42, 0]}
        stroke="#5C4A2E"
        strokeWidth={1.5}
        listening={false}
      />
      <Line
        points={[rightX, cy, w * 0.58, 0]}
        stroke="#5C4A2E"
        strokeWidth={1.5}
        listening={false}
      />
      {/* Skuggor under ringar */}
      <Circle x={leftX} y={cy + r * 0.4} radius={r} fill="#000" opacity={0.18} listening={false} />
      <Circle x={rightX} y={cy + r * 0.4} radius={r} fill="#000" opacity={0.18} listening={false} />
      {/* Ringar */}
      {[leftX, rightX].map((cx) => (
        <Group key={cx}>
          <Circle
            x={cx}
            y={cy}
            radius={r}
            fillRadialGradientStartPoint={{ x: -r * 0.3, y: -r * 0.3 }}
            fillRadialGradientEndPoint={{ x: 0, y: 0 }}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndRadius={r}
            fillRadialGradientColorStops={[0, "#F2D88A", 1, "#A87825"]}
            stroke="#6B4D14"
            strokeWidth={1.2}
            listening={false}
          />
          <Circle
            x={cx}
            y={cy}
            radius={r * 0.55}
            fill="#F4E8CE"
            stroke="#6B4D14"
            strokeWidth={0.8}
            listening={false}
          />
        </Group>
      ))}
    </Group>
  );
}

// ----- färghjälpare -----
function clamp(v: number) {
  return Math.max(0, Math.min(255, v));
}
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v)).toString(16).padStart(2, "0"))
      .join("")
  );
}
export function lighten(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}
export function darken(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
