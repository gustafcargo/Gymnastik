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
