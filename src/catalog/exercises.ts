/** Katalog över övningar per redskapstyp. */
import { useCustomExercisesStore } from "../store/useCustomExercisesStore";

export type Exercise = {
  id: string;
  label: string;       // Visningsnamn (svenska)
  apparatus: string[]; // equipment kind(s) det fungerar på
  speed: number;       // animationsloop i sekunder
};

export const ALL_EXERCISES: Exercise[] = [
  // ── Räck ────────────────────────────────────────────────────────────────
  { id: "high-bar:giant-swing",   label: "Kast bakåt",   apparatus: ["high-bar"], speed: 1.6 },
  { id: "high-bar:kip",           label: "Kip",          apparatus: ["high-bar"], speed: 2.4 },
  { id: "high-bar:swing",         label: "Sving",        apparatus: ["high-bar"], speed: 1.8 },
  { id: "high-bar:overslag",      label: "Överslag",     apparatus: ["high-bar"], speed: 5.0 },
  // ── Barr ────────────────────────────────────────────────────────────────
  { id: "parallel-bars:swing",    label: "Sving",        apparatus: ["parallel-bars"], speed: 1.6 },
  { id: "parallel-bars:support",  label: "Stöd",         apparatus: ["parallel-bars"], speed: 3.0 },
  // ── Ojämna barr ─────────────────────────────────────────────────────────
  { id: "uneven-bars:swing",      label: "Sving",        apparatus: ["uneven-bars"], speed: 1.8 },
  // ── Bom ─────────────────────────────────────────────────────────────────
  { id: "beam:walk",              label: "Gång",         apparatus: ["beam"], speed: 2.0 },
  { id: "beam:jump",              label: "Hopp",         apparatus: ["beam"], speed: 1.4 },
  { id: "beam:stand",             label: "Stå",          apparatus: ["beam"], speed: 4.0 },
  { id: "beam:arabesque",         label: "Arabesque",    apparatus: ["beam"], speed: 3.5 },
  { id: "beam:tuck-jump",         label: "Knähopp",      apparatus: ["beam"], speed: 1.4 },
  { id: "beam:pirouette",         label: "Pirouette",    apparatus: ["beam"], speed: 2.5 },
  { id: "beam:stegserie-1",       label: "Stegserie 1",  apparatus: ["beam"], speed: 14.0 },
  // ── Ringar ──────────────────────────────────────────────────────────────
  { id: "rings:swing",            label: "Sving",        apparatus: ["rings", "rings-free"], speed: 1.8 },
  { id: "rings:cross",            label: "Kors",         apparatus: ["rings", "rings-free"], speed: 4.0 },
  // ── Fristående ──────────────────────────────────────────────────────────
  { id: "floor:handstand",        label: "Handvåg",      apparatus: ["floor"], speed: 3.0 },
  { id: "floor:stand",            label: "Stå",          apparatus: ["floor"], speed: 4.0 },
  { id: "floor:cartwheel",        label: "Hjulning",     apparatus: ["floor"], speed: 1.8 },
  { id: "floor:forward-roll",     label: "Kullerbytta",  apparatus: ["floor"], speed: 1.8 },
  { id: "floor:tuck-jump",        label: "Knähopp",      apparatus: ["floor"], speed: 1.25 },
  // ── Bygelhäst ───────────────────────────────────────────────────────────
  { id: "pommel-horse:scissors",  label: "Saxpendel",    apparatus: ["pommel-horse"], speed: 1.4 },
  // ── Hoppbord ────────────────────────────────────────────────────────────
  { id: "vault:handstand",        label: "Handstående",  apparatus: ["vault"], speed: 3.0 },
  // ── Trampett ────────────────────────────────────────────────────────────
  { id: "mini-tramp:bounce",      label: "Studs",        apparatus: ["mini-tramp", "trampette"], speed: 1.0 },
  // ── Plint ───────────────────────────────────────────────────────────────
  { id: "plinth:stand",           label: "Stå på plint", apparatus: ["plinth", "buck"], speed: 4.0 },
];

/** Built-ins + användarens egna övningar (från useCustomExercisesStore).
 *  Läser en snapshot – för reaktivitet, prenumerera på storen i komponenten
 *  (se `useExercisesForKind`). */
export function allExercises(): Exercise[] {
  const custom = useCustomExercisesStore.getState().customExercises;
  const builtInIds = new Set(ALL_EXERCISES.map((e) => e.id));
  const extras = custom.filter((e) => !builtInIds.has(e.id));
  return [...ALL_EXERCISES, ...extras];
}

/** Reaktiv hook – samma som `exercisesForKind` men triggar re-render när
 *  storen uppdateras. Använd i UI-komponenter. */
export function useExercisesForKind(kind: string): Exercise[] {
  const custom = useCustomExercisesStore((s) => s.customExercises);
  const builtInIds = new Set(ALL_EXERCISES.map((e) => e.id));
  const extras = custom.filter((e) => !builtInIds.has(e.id));
  return [...ALL_EXERCISES, ...extras].filter((e) => e.apparatus.includes(kind));
}

/** Alla övningar tillgängliga för ett givet redskapsslag. */
export function exercisesForKind(kind: string): Exercise[] {
  return allExercises().filter((e) => e.apparatus.includes(kind));
}
