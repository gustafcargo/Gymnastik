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
  "parallel-bars": [
    { key: "railH1",       label: "Räcke 1 – höjd",       min: 0.9,  max: 2.2,  step: 0.05,  unit: "m",  defaultValue: 1.75 },
    { key: "railH2",       label: "Räcke 2 – höjd",       min: 0.9,  max: 2.2,  step: 0.05,  unit: "m",  defaultValue: 1.75 },
    { key: "railSpacing",  label: "Räckesavstånd",        min: 0.3,  max: 0.6,  step: 0.02,  unit: "m",  defaultValue: 0.42 },
  ],
  "uneven-bars": [
    { key: "highBarH",     label: "Högt räcke – höjd",    min: 2.3,  max: 2.8,  step: 0.05,  unit: "m",  defaultValue: 2.55 },
    { key: "lowBarH",      label: "Lågt räcke – höjd",    min: 1.5,  max: 2.0,  step: 0.05,  unit: "m",  defaultValue: 1.75 },
    { key: "barSep",       label: "Avstånd mellan räcken", min: 1.1,  max: 1.95, step: 0.05,  unit: "m",  defaultValue: 1.40 },
  ],
  "high-bar": [
    { key: "barH",         label: "Stånghöjd",            min: 2.0,  max: 3.2,  step: 0.05,  unit: "m",  defaultValue: 2.75 },
  ],
  beam: [
    { key: "beamH",        label: "Bomhöjd",              min: 0.3,  max: 1.4,  step: 0.05,  unit: "m",  defaultValue: 1.25 },
    { key: "beamWidth",    label: "Bombredd",             min: 0.06, max: 0.15, step: 0.01,  unit: "m",  defaultValue: 0.1  },
  ],
  "pommel-horse": [
    { key: "standH",       label: "Höjd (golv→yta)",      min: 0.85, max: 1.25, step: 0.05,  unit: "m",  defaultValue: 0.87 },
    { key: "handleSpacing",label: "Byglarnas avstånd",    min: 0.25, max: 0.6,  step: 0.025, unit: "m",  defaultValue: 0.42 },
  ],
  rings: [
    { key: "ringH",        label: "Ringarnas höjd",       min: 1.5,  max: 5.5,  step: 0.05,  unit: "m",  defaultValue: 2.75 },
  ],
  vault: [
    { key: "standH",       label: "Pelarhöjd",            min: 0.5,  max: 1.4,  step: 0.05,  unit: "m",  defaultValue: 1.12 },
    { key: "padH",         label: "Kudde/pad höjd",       min: 0.1,  max: 0.6,  step: 0.05,  unit: "m",  defaultValue: 0.22 },
  ],
  plinth: [
    { key: "layers",       label: "Antal lager",          min: 1,    max: 8,    step: 1,     unit: "st", defaultValue: 4    },
  ],
  buck: [
    { key: "bodyH",        label: "Total höjd",           min: 0.4,  max: 1.5,  step: 0.05,  unit: "m",  defaultValue: 1.0  },
  ],
  "thick-mat": [
    { key: "matH",         label: "Mattjocklek",          min: 0.05, max: 0.6,  step: 0.025, unit: "m",  defaultValue: 0.2  },
  ],
  "landing-mat": [
    { key: "matH",         label: "Mattjocklek",          min: 0.05, max: 0.5,  step: 0.025, unit: "m",  defaultValue: 0.2  },
  ],
  "tumbling-track": [
    { key: "trackH",       label: "Banans tjocklek",      min: 0.04, max: 0.2,  step: 0.01,  unit: "m",  defaultValue: 0.1  },
  ],
  "air-track": [
    { key: "trackH",       label: "Luftmadrass tjocklek", min: 0.1,  max: 0.5,  step: 0.025, unit: "m",  defaultValue: 0.28 },
  ],
};
