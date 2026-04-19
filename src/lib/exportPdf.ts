import type Konva from "konva";
import type { Plan } from "../types";
import { stageToWhitePngCanvas } from "./exportPng";

type Snapshot = { stationName: string; canvas: HTMLCanvasElement };

/**
 * Exporterar nuvarande station, eller en uppsättning snapshots till PDF.
 * jspdf lazy-importeras så att modulen inte skeppas i initial bundle.
 *
 * iPad Safari har hårda minnesgränser: vi skickar canvas direkt till
 * jsPDF (jspdf accepterar HTMLCanvasElement) istället för att gå via
 * base64-dataURL, som annars allokerar ~4/3× raw-pixlar i strängform.
 */
export async function exportStageAsPdf(
  stage: Konva.Stage,
  plan: Plan,
  snapshots?: Snapshot[],
) {
  try {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const headerHeight = 18;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - headerHeight;

    const shots: Snapshot[] =
      snapshots ?? [
        {
          stationName:
            plan.stations.find((s) => s.id === plan.activeStationId)?.name ??
            "Station",
          canvas: stageToWhitePngCanvas(stage, 2),
        },
      ];

    shots.forEach((shot, idx) => {
      if (idx > 0) pdf.addPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(plan.name, margin, margin + 6);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(
        `${shot.stationName}  •  ${plan.hall.name}  •  ${new Date(
          plan.updatedAt,
        ).toLocaleDateString("sv-SE")}`,
        margin,
        margin + 12,
      );

      const imgW = shot.canvas.width;
      const imgH = shot.canvas.height;
      const ratio = Math.min(availW / imgW, availH / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      const drawX = margin + (availW - drawW) / 2;
      const drawY = margin + headerHeight + (availH - drawH) / 2;
      pdf.addImage(shot.canvas, "PNG", drawX, drawY, drawW, drawH);
    });

    const safeName = plan.name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "pass";
    pdf.save(`${safeName}.pdf`);
  } catch (err) {
    console.warn("[2D] PDF-export misslyckades:", err);
  }
}
