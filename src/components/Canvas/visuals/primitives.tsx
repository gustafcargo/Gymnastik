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

/**
 * Ringar (väggmonterade) – top-down vy.
 * Visar: golvkors (bas-balk), stolp-fötter, kabelsträvor till hörnen och
 * de två ringarna sedda från ovan (smala lodräta skivor = tunna rektanglar).
 */
export function RingsVisual({ w, h, selected }: Props) {
  const baseH = Math.max(4, h * 0.22);
  const baseY = h * 0.72;
  const postR = Math.max(2.5, Math.min(w, h) * 0.055);
  const postLX = w * 0.18;
  const postRX = w * 0.82;
  // Rings hang vertically – seen from above they appear edge-on (narrow strips)
  const ringW = Math.max(2, Math.min(w, h) * 0.045);
  const ringH = Math.max(4, h * 0.12);
  const ring1X = w * 0.36;
  const ring2X = w * 0.64;
  const ringY = h * 0.32;

  return (
    <Group>
      {/* Bounding box */}
      <Rect
        width={w}
        height={h}
        cornerRadius={Math.min(6, h * 0.08)}
        fill="#EDE5D4"
        stroke={selected ? "#0B3FA8" : "#8A7A60"}
        strokeWidth={selected ? 2 : 0.8}
        {...SHADOW(selected)}
      />
      {/* Cable stays – dashed from post tops to floor corners */}
      <Line points={[postLX, baseY, w * 0.04, h * 0.06]} stroke="#6B7280" strokeWidth={0.7} dash={[4, 3]} opacity={0.5} listening={false} />
      <Line points={[postLX, baseY, w * 0.04, h * 0.94]} stroke="#6B7280" strokeWidth={0.7} dash={[4, 3]} opacity={0.5} listening={false} />
      <Line points={[postRX, baseY, w * 0.96, h * 0.06]} stroke="#6B7280" strokeWidth={0.7} dash={[4, 3]} opacity={0.5} listening={false} />
      <Line points={[postRX, baseY, w * 0.96, h * 0.94]} stroke="#6B7280" strokeWidth={0.7} dash={[4, 3]} opacity={0.5} listening={false} />
      {/* Floor cross-piece (golvbalk) */}
      <Rect
        x={w * 0.06}
        y={baseY - baseH / 2}
        width={w * 0.88}
        height={baseH}
        cornerRadius={2}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: baseH }}
        fillLinearGradientColorStops={[0, "#C8B89A", 0.5, "#9A8670", 1, "#6A5C4A"]}
        stroke="#5A4E38"
        strokeWidth={0.6}
        listening={false}
      />
      {/* Post footprints */}
      {[postLX, postRX].map((px) => (
        <Group key={px}>
          <Circle x={px} y={baseY} radius={postR + 1} fill="#000" opacity={0.2} listening={false} />
          <Circle x={px} y={baseY} radius={postR} fill="#7A6B52" stroke="#4A3E2C" strokeWidth={0.6} listening={false} />
        </Group>
      ))}
      {/* Rings – edge-on from above (thin metallic strips) */}
      {[ring1X, ring2X].map((rx) => (
        <Group key={rx}>
          <Rect x={rx - ringW / 2} y={ringY - ringH / 2 + 1.5} width={ringW} height={ringH} cornerRadius={1} fill="#000" opacity={0.2} listening={false} />
          <Rect
            x={rx - ringW / 2}
            y={ringY - ringH / 2}
            width={ringW}
            height={ringH}
            cornerRadius={1}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: ringW, y: 0 }}
            fillLinearGradientColorStops={[0, "#D4A840", 0.5, "#F0C860", 1, "#A87820"]}
            stroke="#7A5820"
            strokeWidth={0.5}
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
