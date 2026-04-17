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
    skin:    "#f5d7a9",
    hair:    "#623a14",
    leotard: "#9838c4",
    ribbon:  "#ff6fa0",
    lip:     "#d8606e",
    pupil:   "#0a0a0a",
    eyebrow: "#c79b88",
  },
  eyes: {
    azimuthDeg: 16.5,
    yFrac: 0.075,
    radius: 0.0095,
    scaleX: 1.25,
    scaleY: 0.95,
    scaleZ: 0.20,
    pupilRadius: 0.0068,
    catchLight: true,
  },
  eyebrows: {
    yFrac: 0.29,
    zFrac: -0.935,
    xFrac: 0.32,
    length: 0.026,
    thickness: 0.0012,
    tiltDeg: 6,
  },
  mouth: {
    yFrac: -0.155,
    zFrac: -0.90,
    radius: 0.025,
    tubeRadius: 0.0036,
  },
  nose: {
    yFrac: -0.135,
    zFrac: -1.12,
    length: 0.015,
    baseRadius: 0.011,
  },
  hair: {
    skullcapThetaFrac: 0.325,
    skullcapScaleY: 1.08,
    bunRadiusFrac: 0.43,
    bunZFrac: 1.06,
  },
  torso: {
    hipWidth: 1.12,
    waistNarrow: 0.94,
    chestWidth: 1.30,
    shoulderWidth: 1.34,
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
    { name: "gymnast-tuning-v2" },
  ),
);
