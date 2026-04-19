import type Konva from "konva";
import type { Plan } from "../types";
import {
  composeA4Page,
  orientationForHall,
  A4_LONG_MM,
  A4_SHORT_MM,
} from "./a4Compose";
import { stageToWhitePngCanvas } from "./exportPng";

type Snapshot = { stationName: string; canvas: HTMLCanvasElement };

/**
 * Exporterar nuvarande station, eller en uppsättning snapshots till PDF.
 * jspdf lazy-importeras så att modulen inte skeppas i initial bundle.
 *
 * Layouten är identisk med PNG-exporten: vit A4, liten marginal, bilden
 * center-croppad i ritytan. Orienteringen styrs av hallens långsida
 * (bred hall → liggande, hög → stående).
 */
export async function exportStageAsPdf(
  stage: Konva.Stage,
  plan: Plan,
  snapshots?: Snapshot[],
) {
  try {
    const { default: jsPDF } = await import("jspdf");

    const shots: Snapshot[] =
      snapshots ?? [
        {
          stationName:
            plan.stations.find((s) => s.id === plan.activeStationId)?.name ??
            "Station",
          canvas: stageToWhitePngCanvas(stage, 2),
        },
      ];
    if (shots.length === 0) return;

    const orient = orientationForHall(plan.hall.widthM, plan.hall.heightM);
    const pdf = new jsPDF({ orientation: orient, unit: "mm", format: "a4" });

    shots.forEach((shot, idx) => {
      if (idx > 0) pdf.addPage("a4", orient);
      const page = composeA4Page(shot.canvas, {
        orient,
        title: plan.name,
        subtitle: `${shot.stationName}  •  ${plan.hall.name}  •  ${new Date(
          plan.updatedAt,
        ).toLocaleDateString("sv-SE")}`,
      });
      const pw = orient === "landscape" ? A4_LONG_MM : A4_SHORT_MM;
      const ph = orient === "landscape" ? A4_SHORT_MM : A4_LONG_MM;
      pdf.addImage(page, "PNG", 0, 0, pw, ph);
    });

    const safeName = plan.name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "pass";
    pdf.save(`${safeName}.pdf`);
  } catch (err) {
    console.warn("[2D] PDF-export misslyckades:", err);
  }
}
