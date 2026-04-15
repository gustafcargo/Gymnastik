import type { HallTemplate } from "../types";

export const HALL_TEMPLATES: HallTemplate[] = [
  { id: "liten",      name: "Liten sal (10 × 20 m)",              widthM: 10, heightM: 20 },
  { id: "standard",   name: "Standard sporthall (15 × 30 m)",     widthM: 15, heightM: 30 },
  { id: "fullstor",   name: "Fullstor gymnastikhall (20 × 40 m)", widthM: 20, heightM: 40 },
  { id: "specialhall",name: "Specialhall (25 × 50 m)",            widthM: 25, heightM: 50 },
];

export const DEFAULT_HALL: HallTemplate = HALL_TEMPLATES[0];
