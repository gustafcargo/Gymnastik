import type Konva from "konva";
import type { Plan } from "../types";
import { stageToWhitePngDataUrl } from "./exportPng";

type Snapshot = { stationName: string; dataUrl: string };

/**
 * Exporterar nuvarande station, eller en uppsättning snapshots till PDF.
 * jspdf lazy-importeras så att modulen inte skeppas i initial bundle.
 */
export async function exportStageAsPdf(
  stage: Konva.Stage,
  plan: Plan,
  snapshots?: Snapshot[],
) {
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
        dataUrl: await stageToWhitePngDataUrl(stage, 2),
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

    // Fit image inom tillgänglig yta
    const img = new Image();
    img.src = shot.dataUrl;
    // Vi känner inte till image-mått direkt; anta stage-proportioner
    // Vi återanvänder stage:ns aspect ratio.
    const ratio = stage.width() / stage.height();
    let drawW = availW;
    let drawH = drawW / ratio;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * ratio;
    }
    const drawX = margin + (availW - drawW) / 2;
    const drawY = margin + headerHeight + (availH - drawH) / 2;
    pdf.addImage(shot.dataUrl, "PNG", drawX, drawY, drawW, drawH);
  });

  const safeName = plan.name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "pass";
  pdf.save(`${safeName}.pdf`);
}
