/**
 * Designtokens för 2D-canvas — "Arkitekt-blueprint + nordisk flat".
 *
 * Centraliserar bakgrund, stroke-tyngd, selection-toning och kategori-
 * kodad pastellpalett så att alla Konva-visuals delar samma språk och
 * utskrivet material blir enhetligt i både färg och s/v.
 */

// ----- Bas: papper och bläck -----
export const PAPER = "#F5EFE4";
export const INK = "#1E3A5F";
export const INK_SOFT = "#3A5070";
export const INK_FAINT = "rgba(30,58,95,0.22)";
export const INK_GHOST = "rgba(30,58,95,0.08)";

// ----- Selection -----
export const SELECT_STROKE = "#2563EB";
export const SELECT_WIDTH = 1.6;
export const BASE_STROKE_WIDTH = 0.8;

// ----- Kategori-kodade pastellfyllnader -----
export const FILL_BARS = "#CEDBE8";          // parallel-/uneven-bars, high-bar
export const FILL_BEAM = "#E0D2B4";          // bom
export const FILL_RINGS = "#E6D6C4";         // ringar + rings-free bg
export const FILL_VAULT = "#E5CAAC";         // hoppbord
export const FILL_TRAMP = "#CFE0E6";         // trampetter + mini-tramp
export const FILL_PLINTH = "#D6BFA0";        // plint + bock
export const FILL_PH = "#D4C2A8";            // bygelhäst

// Mattor (ljushet-distinkt för s/v-läsbarhet)
export const FILL_MAT_TUMBLING = "#C6D8C8";  // tumbling-track (sage)
export const FILL_MAT_THICK = "#C8D3E1";     // tjockmatta (soft slate)
export const FILL_MAT_LANDING = "#E5D3B4";   // landningsmatta (warm tan)
export const FILL_MAT_AIR = "#D0E1E6";       // airtrack (ice)
export const FILL_FLOOR = "#E1DAC8";         // fristående-golv (warm cream)

// Övrigt
export const FILL_PIT = "#BECBD6";           // hoppgrop
export const FILL_WALLBARS = "#DACBAB";      // ribbstol
export const FILL_BENCH = "#E0D2B4";         // gymnastikbänk
export const FILL_ROPE = "#D3C9DD";          // klätterrep

// ----- Subtil skugga (opt-in) -----
export const SOFT_SHADOW = {
  shadowColor: "#0F172A",
  shadowBlur: 2,
  shadowOpacity: 0.06,
  shadowOffsetY: 1,
} as const;

// ----- Typografi -----
export const LABEL_FONT_FAMILY =
  "InterVariable, Inter, system-ui, sans-serif";

/** Stroke för icke-selekterade redskap. */
export function strokeFor(selected: boolean) {
  return {
    stroke: selected ? SELECT_STROKE : INK,
    strokeWidth: selected ? SELECT_WIDTH : BASE_STROKE_WIDTH,
  };
}
