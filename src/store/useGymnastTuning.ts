/**
 * useGymnastTuning – zustand-store med alla kosmetiska/form-parametrar
 * för gymnasten. Läses av GymnastBody och skrivs av Leva-panelen. Alla
 * värden persisteras i localStorage så tweaks överlever reload.
 *
 * SCOPE (medvetet begränsad): endast parametrar som påverkar RENDERING,
 * inte skelett-proportionerna (H_TORSO, R_BODY etc.) eftersom de är
 * inbakade i koreografi-koden. Formvariationer på bål sker via profil-
 * multiplikatorer som bara skalar om LatheGeometry-konturen.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GymnastTuning = {
  // ── Färger ───────────────────────────────────────────────────
  colors: {
    skin: string;
    hair: string;
    leotard: string;
    ribbon: string;
    lip: string;
    pupil: string;
    eyebrow: string;
  };

  // ── Ögon ─────────────────────────────────────────────────────
  eyes: {
    azimuthDeg: number;       // sidvinkel från ansiktsaxeln
    yFrac: number;            // Y-offset som fraktion av H_HEAD
    radius: number;           // ögonbollens grund-radie (m)
    scaleX: number;           // horisontell bredd (relativ)
    scaleY: number;           // vertikal höjd (relativ)
    scaleZ: number;           // utbuktning framåt (relativ)
    pupilRadius: number;      // pupillens radie (m)
    catchLight: boolean;      // visa ljusreflex
  };

  // ── Ögonbryn ─────────────────────────────────────────────────
  eyebrows: {
    yFrac: number;            // Y-offset (fraktion av H_HEAD)
    zFrac: number;            // Z-offset (negativ = framåt)
    xFrac: number;            // sidled från centrum
    length: number;           // streckets längd (m)
    thickness: number;        // radie (m)
    tiltDeg: number;          // vinkel (+ = inre ned)
  };

  // ── Mun ──────────────────────────────────────────────────────
  mouth: {
    yFrac: number;
    zFrac: number;
    radius: number;           // torusens huvudradie
    tubeRadius: number;       // läpptjocklek
  };

  // ── Näsa ─────────────────────────────────────────────────────
  nose: {
    yFrac: number;
    zFrac: number;
    length: number;           // konens höjd
    baseRadius: number;       // konens basradie
  };

  // ── Hår ──────────────────────────────────────────────────────
  hair: {
    skullcapThetaFrac: number;  // hur långt ned skullcap når (fraktion av π)
    skullcapScaleY: number;     // Y-skala för skullcap
    bunRadiusFrac: number;      // hårknutens radie (fraktion av H_HEAD)
    bunZFrac: number;           // knutens bakåt-offset (fraktion av H_HEAD)
  };

  // ── Torso-profil (kosmetisk rendering, påverkar EJ skelett) ──
  torso: {
    hipWidth: number;           // multiplikator för höftens bredaste radie
    waistNarrow: number;        // multiplikator för midjans smalaste radie
    chestWidth: number;         // multiplikator för bröstkorgens bredaste radie
    shoulderWidth: number;      // multiplikator för axelparti
  };
};

export const DEFAULT_TUNING: GymnastTuning = {
  colors: {
    skin:    "#E8C99A",
    hair:    "#2d1a08",
    leotard: "#C2185B",
    ribbon:  "#ff6fa0",
    lip:     "#b23a48",
    pupil:   "#0a0a0a",
    eyebrow: "#2a1810",
  },
  eyes: {
    azimuthDeg: 18,
    yFrac: 0.08,
    radius: 0.012,
    scaleX: 1.45,
    scaleY: 0.85,
    scaleZ: 0.55,
    pupilRadius: 0.0040,
    catchLight: true,
  },
  eyebrows: {
    yFrac: 0.23,
    zFrac: -0.89,
    xFrac: 0.32,
    length: 0.030,
    thickness: 0.0022,
    tiltDeg: 9,
  },
  mouth: {
    yFrac: -0.34,
    zFrac: -0.91,
    radius: 0.026,
    tubeRadius: 0.0022,
  },
  nose: {
    yFrac: -0.04,
    zFrac: -0.96,
    length: 0.045,
    baseRadius: 0.012,
  },
  hair: {
    skullcapThetaFrac: 0.32,
    skullcapScaleY: 1.12,
    bunRadiusFrac: 0.42,
    bunZFrac: 1.08,
  },
  torso: {
    hipWidth: 1.06,
    waistNarrow: 0.74,
    chestWidth: 1.38,
    shoulderWidth: 1.42,
  },
};

type TuningStore = GymnastTuning & {
  update: <K extends keyof GymnastTuning>(section: K, patch: Partial<GymnastTuning[K]>) => void;
  reset: () => void;
};

export const useGymnastTuning = create<TuningStore>()(
  persist(
    (set) => ({
      ...DEFAULT_TUNING,
      update: (section, patch) =>
        set((s) => ({ ...s, [section]: { ...s[section], ...patch } })),
      reset: () => set({ ...DEFAULT_TUNING }),
    }),
    { name: "gymnast-tuning-v1" },
  ),
);
