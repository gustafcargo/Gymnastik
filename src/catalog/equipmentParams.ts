export type EquipmentParamDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
};

/**
 * Justerbara geometriparametrar per redskapstyp.
 * Nyckel matchar EquipmentDetail.kind.
 */
export const EQUIPMENT_PARAMS: Partial<Record<string, EquipmentParamDef[]>> = {
  "high-bar": [
    { key: "barH", label: "Stånghöjd", min: 2.0, max: 3.2, step: 0.05, unit: "m", defaultValue: 2.75 },
  ],
  beam: [
    { key: "beamH", label: "Bomhöjd", min: 0.3, max: 1.4, step: 0.05, unit: "m", defaultValue: 1.25 },
  ],
  "parallel-bars": [
    { key: "railH1", label: "Lägre räcke (höjd)", min: 0.9, max: 2.0, step: 0.05, unit: "m", defaultValue: 1.7 },
    { key: "railH2", label: "Högre räcke (höjd)", min: 1.0, max: 2.2, step: 0.05, unit: "m", defaultValue: 1.95 },
  ],
  "pommel-horse": [
    { key: "standH", label: "Stativhöjd", min: 0.3, max: 1.4, step: 0.05, unit: "m", defaultValue: 0.78 },
  ],
  vault: [
    { key: "standH", label: "Pelarhöjd", min: 0.5, max: 1.4, step: 0.05, unit: "m", defaultValue: 0.98 },
    { key: "padH", label: "Kudde/pad höjd", min: 0.1, max: 0.6, step: 0.05, unit: "m", defaultValue: 0.38 },
  ],
  plinth: [
    { key: "layers", label: "Antal lager", min: 1, max: 8, step: 1, unit: "st", defaultValue: 4 },
  ],
  buck: [
    { key: "bodyH", label: "Total höjd", min: 0.4, max: 1.5, step: 0.05, unit: "m", defaultValue: 1.0 },
  ],
};
