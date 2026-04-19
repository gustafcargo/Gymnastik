import type Konva from "konva";
import type { Plan } from "../types";
import { stageToWhitePngCanvas } from "./exportPng";

type Snapshot = { stationName: string; canvas: HTMLCanvasElement };

const A4_LONG = 297; // mm
const A4_SHORT = 210;
const MARGIN = 8;
const HEADER_H = 16;

type Orientation = "landscape" | "portrait";

/**
 * Välj A4-orientering som minimerar död yta runt bilden. En bred bild
 * passar bäst på liggande A4, en hög på stående — hallar i 30×15 får
 * liggande, 24×30 får stående. Returnerar både orienteringen och den
 * inskalade ritytan.
 */
function pickOrientation(imgW: number, imgH: number) {
  const candidates: Array<{
    orient: Orientation;
    pageW: number;
    pageH: number;
    availW: number;
    availH: number;
  }> = [
    {
      orient: "landscape",
      pageW: A4_LONG,
      pageH: A4_SHORT,
      availW: A4_LONG - MARGIN * 2,
      availH: A4_SHORT - MARGIN * 2 - HEADER_H,
    },
    {
      orient: "portrait",
      pageW: A4_SHORT,
      pageH: A4_LONG,
      availW: A4_SHORT - MARGIN * 2,
      availH: A4_LONG - MARGIN * 2 - HEADER_H,
    },
  ];
  let best = candidates[0];
  let bestArea = 0;
  for (const c of candidates) {
    const ratio = Math.min(c.availW / imgW, c.availH / imgH);
    const area = imgW * ratio * (imgH * ratio);
    if (area > bestArea) {
      bestArea = area;
      best = c;
    }
  }
  return best;
}

/**
 * Exporterar nuvarande station, eller en uppsättning snapshots till PDF.
 * jspdf lazy-importeras så att modulen inte skeppas i initial bundle.
 *
 * iPad Safari har hårda minnesgränser: vi skickar canvas direkt till
 * jsPDF (jspdf accepterar HTMLCanvasElement) istället för att gå via
 * base64-dataURL, som annars allokerar ~4/3× raw-pixlar i strängform.
 *
 * Orienteringen väljs per sida utifrån bildens proportioner — så att
 * liggande halla inte trycks ihop på en stående sida med massor av
 * död yta, och tvärtom.
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

    const firstLayout = pickOrientation(
      shots[0].canvas.width,
      shots[0].canvas.height,
    );
    const pdf = new jsPDF({
      orientation: firstLayout.orient,
      unit: "mm",
      format: "a4",
    });

    shots.forEach((shot, idx) => {
      const layout =
        idx === 0
          ? firstLayout
          : pickOrientation(shot.canvas.width, shot.canvas.height);
      if (idx > 0) {
        pdf.addPage("a4", layout.orient);
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(plan.name, MARGIN, MARGIN + 6);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(
        `${shot.stationName}  •  ${plan.hall.name}  •  ${new Date(
          plan.updatedAt,
        ).toLocaleDateString("sv-SE")}`,
        MARGIN,
        MARGIN + 12,
      );

      const imgW = shot.canvas.width;
      const imgH = shot.canvas.height;
      const ratio = Math.min(layout.availW / imgW, layout.availH / imgH);
      const drawW = imgW * ratio;
      const drawH = imgH * ratio;
      const drawX = MARGIN + (layout.availW - drawW) / 2;
      const drawY = MARGIN + HEADER_H + (layout.availH - drawH) / 2;
      pdf.addImage(shot.canvas, "PNG", drawX, drawY, drawW, drawH);
    });

    const safeName = plan.name.replace(/[^\w\-]+/g, "_").slice(0, 60) || "pass";
    pdf.save(`${safeName}.pdf`);
  } catch (err) {
    console.warn("[2D] PDF-export misslyckades:", err);
  }
}
