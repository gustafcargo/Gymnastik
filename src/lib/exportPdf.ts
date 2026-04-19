import type Konva from "konva";
import type { Plan } from "../types";
import {
  composeA4Page,
  orientationForAspect,
  A4_LONG_MM,
  A4_SHORT_MM,
} from "./a4Compose";
import { stageToWhitePngCanvas } from "./exportPng";

type Snapshot = { canvas: HTMLCanvasElement };

/**
 * Exporterar nuvarande station, eller en uppsättning snapshots till PDF.
 * jspdf lazy-importeras så att modulen inte skeppas i initial bundle.
 *
 * Layouten är identisk med PNG-exporten: vit A4, liten marginal, bilden
 * center-croppad i ritytan. Orienteringen följer den synliga ritytan
 * (bred canvas → liggande A4, hög → stående) så att utskriften matchar
 * det som användaren ser innanför A4-ramen.
 */
export async function exportStageAsPdf(
  stage: Konva.Stage,
  plan: Plan,
  snapshots?: Snapshot[],
) {
  try {
    const { default: jsPDF } = await import("jspdf");

    const shots: Snapshot[] =
      snapshots ?? [{ canvas: stageToWhitePngCanvas(stage, 2) }];
    if (shots.length === 0) return;

    const first = shots[0].canvas;
    const orient = orientationForAspect(first.width, first.height);
    const pdf = new jsPDF({ orientation: orient, unit: "mm", format: "a4" });

    shots.forEach((shot, idx) => {
      const shotOrient = orientationForAspect(
        shot.canvas.width,
        shot.canvas.height,
      );
      if (idx > 0) pdf.addPage("a4", shotOrient);
      const page = composeA4Page(shot.canvas, {
        orient: shotOrient,
        title: plan.name,
        subtitle: plan.hall.name,
      });
      const pw = shotOrient === "landscape" ? A4_LONG_MM : A4_SHORT_MM;
      const ph = shotOrient === "landscape" ? A4_SHORT_MM : A4_LONG_MM;
      pdf.addImage(page, "PNG", 0, 0, pw, ph);
    });

    const safeName = plan.name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "pass";
    pdf.save(`${safeName}.pdf`);
  } catch (err) {
    console.warn("[2D] PDF-export misslyckades:", err);
  }
}
