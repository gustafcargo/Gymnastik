/**
 * A4-sidkompositör. Både PNG- och PDF-export bygger på samma layout:
 * en vit A4-sida med liten marginal runt om och innehåll som fyller
 * hela ritytan (center-cropped om proportionerna skiljer sig från
 * A4:s). På så sätt slipper vi död yta i utskriften oavsett om
 * källbilden är lite bredare eller smalare än sidan.
 */

export const A4_LONG_MM = 297;
export const A4_SHORT_MM = 210;
export const A4_MARGIN_MM = 8;
export const A4_HEADER_MM = 16;

export type A4Orientation = "landscape" | "portrait";

export type A4Layout = {
  orient: A4Orientation;
  pageW: number;
  pageH: number;
  availW: number;
  availH: number;
  contentAspect: number;
};

/** Långsidan horisontell → liggande A4; annars stående. */
export function orientationForHall(
  widthM: number,
  heightM: number,
): A4Orientation {
  return widthM >= heightM ? "landscape" : "portrait";
}

export function a4Layout(orient: A4Orientation): A4Layout {
  if (orient === "landscape") {
    const availW = A4_LONG_MM - A4_MARGIN_MM * 2;
    const availH = A4_SHORT_MM - A4_MARGIN_MM * 2 - A4_HEADER_MM;
    return {
      orient,
      pageW: A4_LONG_MM,
      pageH: A4_SHORT_MM,
      availW,
      availH,
      contentAspect: availW / availH,
    };
  }
  const availW = A4_SHORT_MM - A4_MARGIN_MM * 2;
  const availH = A4_LONG_MM - A4_MARGIN_MM * 2 - A4_HEADER_MM;
  return {
    orient,
    pageW: A4_SHORT_MM,
    pageH: A4_LONG_MM,
    availW,
    availH,
    contentAspect: availW / availH,
  };
}

/**
 * Ritar källans canvas på en ny A4-sida: vit bakgrund, rubrik + underrubrik
 * i övre vänstra hörnet, och bilden center-croppad för att fylla ritytan.
 * `pixelScale` styr output-upplösningen (px/mm). 8 px/mm ≈ 200 DPI.
 */
export function composeA4Page(
  src: HTMLCanvasElement,
  opts: {
    orient: A4Orientation;
    title: string;
    subtitle: string;
    pixelScale?: number;
  },
): HTMLCanvasElement {
  const pixelScale = opts.pixelScale ?? 8;
  const layout = a4Layout(opts.orient);
  const pageWpx = Math.round(layout.pageW * pixelScale);
  const pageHpx = Math.round(layout.pageH * pixelScale);
  const marginPx = Math.round(A4_MARGIN_MM * pixelScale);
  const headerPx = Math.round(A4_HEADER_MM * pixelScale);
  const contentX = marginPx;
  const contentY = marginPx + headerPx;
  const contentW = Math.round(layout.availW * pixelScale);
  const contentH = Math.round(layout.availH * pixelScale);

  const out = document.createElement("canvas");
  out.width = pageWpx;
  out.height = pageHpx;
  const ctx = out.getContext("2d");
  if (!ctx) return src;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, pageWpx, pageHpx);

  ctx.fillStyle = "#1E3A5F";
  ctx.font = `700 ${Math.round(6 * pixelScale)}px InterVariable, Inter, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(opts.title, marginPx, Math.round(4 * pixelScale));
  if (opts.subtitle) {
    ctx.fillStyle = "#3A5070";
    ctx.font = `400 ${Math.round(3.2 * pixelScale)}px InterVariable, Inter, system-ui, sans-serif`;
    ctx.fillText(opts.subtitle, marginPx, Math.round(11 * pixelScale));
  }

  // Center-crop källan så att ritytan fylls utan letterbox.
  const srcW = src.width;
  const srcH = src.height;
  const srcAspect = srcW / srcH;
  const contentAspect = layout.contentAspect;
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;
  if (srcAspect > contentAspect) {
    sw = Math.round(srcH * contentAspect);
    sx = Math.round((srcW - sw) / 2);
  } else if (srcAspect < contentAspect) {
    sh = Math.round(srcW / contentAspect);
    sy = Math.round((srcH - sh) / 2);
  }
  ctx.drawImage(src, sx, sy, sw, sh, contentX, contentY, contentW, contentH);

  // Tunn ram runt ritytan så det syns att "här är A4:an".
  ctx.strokeStyle = "rgba(30,58,95,0.35)";
  ctx.lineWidth = Math.max(1, Math.round(0.2 * pixelScale));
  ctx.strokeRect(contentX, contentY, contentW, contentH);

  return out;
}
