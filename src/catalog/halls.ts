import type { HallTemplate } from "../types";

export const HALL_TEMPLATES: HallTemplate[] = [
  { id: "liten", name: "Liten hall (15 × 15 m)", widthM: 15, heightM: 15 },
  {
    id: "standard",
    name: "Standard sporthall (20 × 40 m)",
    widthM: 20,
    heightM: 40,
  },
  {
    id: "fullstor",
    name: "Fullstor gymnastikhall (25 × 50 m)",
    widthM: 25,
    heightM: 50,
  },
  {
    id: "specialhall",
    name: "Gymnastikens specialhall (30 × 60 m)",
    widthM: 30,
    heightM: 60,
  },
];

export const DEFAULT_HALL: HallTemplate = HALL_TEMPLATES[1];
