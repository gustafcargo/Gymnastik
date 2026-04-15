import type Konva from "konva";

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportStageAsPng(
  stage: Konva.Stage,
  filename: string,
  pixelRatio = 2,
) {
  // Force all layers (including conditionally-mounted note bubbles layer) to
  // flush their canvases before capture so nothing is stale or missing.
  stage.draw();
  const url = stage.toDataURL({ pixelRatio, mimeType: "image/png" });
  downloadDataUrl(url, filename);
  return url;
}
