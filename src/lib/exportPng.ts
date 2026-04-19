import type Konva from "konva";

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Komponerar stage:ns canvas ovanpå en vit bakgrund så att PNG:n inte får
 * genomskinliga områden (vilket renderas svart i många PDF- och bild-
 * visare). Retur: data URL till PNG med vit bakgrund.
 */
export async function stageToWhitePngDataUrl(
  stage: Konva.Stage,
  pixelRatio = 2,
): Promise<string> {
  stage.draw();
  const stageUrl = stage.toDataURL({ pixelRatio, mimeType: "image/png" });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Kunde inte ladda stage-bild"));
    img.src = stageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return stageUrl;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function exportStageAsPng(
  stage: Konva.Stage,
  filename: string,
  pixelRatio = 2,
) {
  const url = await stageToWhitePngDataUrl(stage, pixelRatio);
  downloadDataUrl(url, filename);
  return url;
}
