import type Konva from "konva";
import type { Plan } from "../types";
import { composeA4Page, orientationForAspect } from "./a4Compose";

// Exporterna körs även på iPad Safari, som har hårda minnesgränser
// (~200–400 MB). Stora canvas + base64-dataURL får appen att krascha.
// Därför: skala ner om bilden blir för stor, använd toBlob +
// object-URL istället för toDataURL, och slipp mellan-canvas-via-Image.
const MAX_EXPORT_DIM = 2400;

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function computeScale(srcW: number, srcH: number): number {
  const longest = Math.max(srcW, srcH);
  return longest > MAX_EXPORT_DIM ? MAX_EXPORT_DIM / longest : 1;
}

/**
 * Ritar stagen på en vit canvas (utan A4-ramverk). Används internt när
 * A4-kompositören tar över header/marginal-bit.
 */
export function stageToWhitePngCanvas(
  stage: Konva.Stage,
  pixelRatio = 2,
): HTMLCanvasElement {
  stage.draw();
  const srcW = stage.width() * pixelRatio;
  const srcH = stage.height() * pixelRatio;
  const scale = computeScale(srcW, srcH);
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const stageCanvas = stage.toCanvas({ pixelRatio });

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return stageCanvas;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(
    stageCanvas,
    0,
    0,
    stageCanvas.width,
    stageCanvas.height,
    0,
    0,
    outW,
    outH,
  );
  return out;
}

/**
 * Bygger en färdig A4-sida (vald orientering efter stagens synliga
 * ritytan) med stagen center-croppad i ritytan + rubrik/underrubrik.
 */
export function stageToA4Canvas(
  stage: Konva.Stage,
  plan: Plan,
  pixelRatio = 2,
): HTMLCanvasElement {
  const raw = stageToWhitePngCanvas(stage, pixelRatio);
  const orient = orientationForAspect(raw.width, raw.height);
  return composeA4Page(raw, {
    orient,
    title: plan.name,
    subtitle: plan.hall.name,
  });
}

/**
 * Bakåtkompatibelt wrapper som fortfarande returnerar en data-URL.
 */
export async function stageToWhitePngDataUrl(
  stage: Konva.Stage,
  pixelRatio = 2,
): Promise<string> {
  const canvas = stageToWhitePngCanvas(stage, pixelRatio);
  return canvas.toDataURL("image/png");
}

export async function exportStageAsPng(
  stage: Konva.Stage,
  plan: Plan,
  filename: string,
  pixelRatio = 2,
) {
  try {
    const canvas = stageToA4Canvas(stage, plan, pixelRatio);
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
        resolve();
      }, "image/png");
    });
  } catch (err) {
    console.warn("[2D] PNG-export misslyckades:", err);
  }
}
