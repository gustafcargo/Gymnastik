import { Circle, Group, Line, Rect } from "react-konva";
import { INK, INK_SOFT, strokeFor } from "./designTokens";

type Props = { w: number; h: number; selected: boolean };

/**
 * Platt matta i blueprint-stil. Pastellfyllning + smal INK-kontur +
 * streckad inre rektangel som markerar stoppkant.
 */
export function MatVisual({
  w,
  h,
  selected,
  base,
}: Props & { base: string; light?: string; dark?: string; stitch?: string }) {
  const r = Math.min(8, Math.min(w, h) * 0.08);
  const inset = Math.min(6, Math.min(w, h) * 0.08);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={base}
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
          strokeWidth={0.4}
          dash={[3, 3]}
          opacity={0.6}
          fill="transparent"
          listening={false}
        />
      )}
    </Group>
  );
}

/**
 * Platt trä-ish redskap i blueprint-stil. Pastellfyllning + INK-kontur.
 * `feltStripe` ritar en mild centerremsa (används av bom).
 */
export function WoodVisual({
  w,
  h,
  selected,
  base,
  feltStripe,
}: Props & { base: string; feltStripe?: boolean }) {
  const r = Math.min(8, Math.min(w, h) * 0.18);
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill={base}
        {...strokeFor(selected)}
      />
      {feltStripe && w > 10 && (
        <Rect
          x={3}
          y={h * 0.42}
          width={w - 6}
          height={h * 0.16}
          cornerRadius={Math.min(3, r * 0.4)}
          fill="transparent"
          stroke={INK_SOFT}
          strokeWidth={0.4}
          opacity={0.7}
          listening={false}
        />
      )}
    </Group>
  );
}

/**
 * Ringar (väggmonterade) – platt top-down vy.
 * Bounding-rect + två cirklar för ringplacering + två postcirklar längs
 * baskanten. Ingen gradient, inga kabelsträvor — läses som arkitektplan.
 */
export function RingsVisual({ w, h, selected }: Props) {
  const r = Math.min(6, Math.min(h, w) * 0.08);
  const baseY = h * 0.78;
  const postR = Math.max(2.5, Math.min(w, h) * 0.05);
  const postLX = w * 0.2;
  const postRX = w * 0.8;
  const ringR = Math.max(3, Math.min(w, h) * 0.055);
  const ring1X = w * 0.36;
  const ring2X = w * 0.64;
  const ringY = h * 0.35;
  return (
    <Group>
      <Rect
        width={w}
        height={h}
        cornerRadius={r}
        fill="#E6D6C4"
        {...strokeFor(selected)}
      />
      {/* Bas-balk markerad som tunn linje mellan stolparna */}
      <Line
        points={[postLX, baseY, postRX, baseY]}
        stroke={INK_SOFT}
        strokeWidth={0.5}
        listening={false}
      />
      {/* Stolp-fötter (mörkare cirklar vid basen) */}
      {[postLX, postRX].map((px) => (
        <Circle
          key={`post-${px}`}
          x={px}
          y={baseY}
          radius={postR}
          fill={INK}
          listening={false}
        />
      ))}
      {/* Två ringar sedda uppifrån */}
      {[ring1X, ring2X].map((rx) => (
        <Circle
          key={`ring-${rx}`}
          x={rx}
          y={ringY}
          radius={ringR}
          fill={INK_SOFT}
          listening={false}
        />
      ))}
    </Group>
  );
}

// ----- färghjälpare (bevaras för override-fall och extruded 3D) -----
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
