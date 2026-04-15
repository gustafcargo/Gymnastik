// Enheter: alla x, y, widthM, heightM är i meter.
// Canvas konverterar via pixelsPerMeter (se lib/geometry.ts).

export type EquipmentCategory = "redskap" | "matta" | "hopp" | "tillbehor";

export type EquipmentShape = "rect" | "roundedRect" | "ellipse";

export type EquipmentType = {
  id: string;
  name: string;
  category: EquipmentCategory;
  widthM: number;
  heightM: number;
  /** Verklig fysisk höjd över golvet i meter (för 3D-vyn). */
  physicalHeightM: number;
  color: string; // Tailwind-färg (hex)
  shape: EquipmentShape;
  /** SVG-detaljer som ritas ovanpå grundformen (koordinater 0..1 relativa). */
  detail?: EquipmentDetail;
  description?: string;
  /** Anpassade 3D-byggstenar (för egna redskap). */
  customParts?: CustomEquipmentPart[];
};

export type ViewMode = "2D" | "3D";

export type EquipmentDetail =
  | { kind: "parallel-bars" }
  | { kind: "high-bar" }
  | { kind: "beam" }
  | { kind: "pommel-horse" }
  | { kind: "rings" }
  | { kind: "vault" }
  | { kind: "trampette" }
  | { kind: "mini-tramp" }
  | { kind: "tumbling-track" }
  | { kind: "air-track" }
  | { kind: "floor" }
  | { kind: "thick-mat" }
  | { kind: "landing-mat" }
  | { kind: "plinth" }
  | { kind: "buck" }
  | { kind: "foam-pit" };

export type PlacedEquipment = {
  id: string;
  typeId: string;
  x: number; // meter
  y: number; // meter
  rotation: number; // grader
  scaleX: number;
  scaleY: number;
  notes?: string;
  label?: string;
  /** Valfri färgöverlagring (hex) för 2D- och 3D-vyn. */
  customColor?: string;
  /** Per-del färgöverlagringar (hex), nyckel = delens namn (se EQUIPMENT_PARTS). */
  partColors?: Record<string, string>;
  /** Per-del geometriöverlagringar (se EQUIPMENT_PARAMS). */
  params?: Record<string, number>;
  /** Höjd från golvet i meter (för mattstack mm.). Standard: 0. */
  z?: number;
  /** Förskjutning (meter) av anteckningsbubblan relativt redskapets centrum. */
  noteOffset?: { x: number; y: number };
  /** Om redskapet skapades från en sparad mall, dess mall-id. */
  templateId?: string;
};

export type HallTemplate = {
  id: string;
  name: string;
  widthM: number;
  heightM: number;
  isCustom?: boolean;
};

export type Station = {
  id: string;
  name: string;
  durationMin: number;
  equipment: PlacedEquipment[];
  notes?: string;
};

export type Plan = {
  id: string;
  name: string;
  hall: HallTemplate;
  stations: Station[];
  activeStationId: string;
  createdAt: number;
  updatedAt: number;
};

/**
 * En byggsten i ett eget redskap.
 * Koordinater är relativt redskapets fotpunktens mitt; Y=0 är golvet.
 */
export type CustomEquipmentPart = {
  id: string;
  shape: "box" | "cylinder" | "sphere" | "cone" | "torus";
  offsetX: number; // m från centrum (X-axel)
  offsetY: number; // m från golv (Y-axel) = underkant av delen
  offsetZ: number; // m från centrum (Z-axel = djup i 2D)
  w: number;       // bredd (X); för cylinder/sfär = diameter
  h: number;       // höjd (Y)
  d: number;       // djup (Z); bara för box
  color?: string;
  rotationY?: number; // grader
};

/** Sparad redskaps-mall – baseras på en befintlig typ men med anpassade färger/params. */
export type SavedEquipmentTemplate = {
  id: string;
  name: string;
  baseTypeId: string;
  customColor?: string;
  partColors?: Record<string, string>;
  params?: Record<string, number>;
  z?: number;
  notes?: string;
  createdAt: number;
};
