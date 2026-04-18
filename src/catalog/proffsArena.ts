/**
 * Proffs-arena – den fasta hall + utplacering av poänggivande redskap som
 * används när spelaren är i Proffs-läget. Syftet är att alla spelare
 * (lokalt + i multiplayer) tävlar i exakt samma miljö så att highscore
 * och topplistor blir jämförbara, oavsett användarens egna planer.
 *
 * Regel: endast redskap som har minst en scoring-övning (tricks eller
 * holdZones) inkluderas. Se isScoringExerciseId() i GameGymnast3D för
 * definition. Plint, bygelhäst, barr, ojämna barr m.fl. saknar i dagsläget
 * scoring-övningar och ingår därför inte.
 */
import type { HallTemplate, PlacedEquipment, Station } from "../types";

export const PROFFS_HALL: HallTemplate = {
  id: "__proffs_arena__",
  name: "Proffs-arena",
  widthM: 30,
  heightM: 24,
};

const place = (
  id: string,
  typeId: string,
  x: number,
  y: number,
): PlacedEquipment => ({
  id,
  typeId,
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
});

/**
 * Fasta ID:n så per-redskap-progressionen (equipmentBestClear, attempts) är
 * stabil mellan sessioner och mellan spelare i samma rum.
 */
export const PROFFS_EQUIPMENT_IDS = {
  RACK: "proffs-rack",
  BOM: "proffs-bom",
  RINGAR: "proffs-ringar-fri",
  HOPP: "proffs-hopp",
  MINITRAMP: "proffs-minitramp",
  GOLV: "proffs-golv",
} as const;

export const PROFFS_STATION: Station = {
  id: "__proffs_station__",
  name: "Proffs-arena",
  durationMin: 0,
  equipment: [
    // Bakre rad (z ≈ 5) — upprättstående redskap
    place(PROFFS_EQUIPMENT_IDS.RACK,      "rack",       5,    5),
    place(PROFFS_EQUIPMENT_IDS.BOM,       "bom",        12,   5),
    place(PROFFS_EQUIPMENT_IDS.RINGAR,    "ringar-fri", 18,   5),
    place(PROFFS_EQUIPMENT_IDS.HOPP,      "hopp",       22.5, 5),
    place(PROFFS_EQUIPMENT_IDS.MINITRAMP, "minitramp",  26,   5),
    // Främre del — fristående-matta fyller mitten
    place(PROFFS_EQUIPMENT_IDS.GOLV,      "golv",       15,   15),
  ],
};
