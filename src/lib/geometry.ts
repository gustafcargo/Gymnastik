/**
 * Geometri-hjälpare. Appen lagrar koordinater i meter och konverterar till
 * pixlar vid rendering. En "viewportscale" bestämmer hur många pixlar som
 * motsvarar en meter baserat på tillgänglig canvasstorlek.
 */

export function computePixelsPerMeter(
  canvasWidthPx: number,
  canvasHeightPx: number,
  hallWidthM: number,
  hallHeightM: number,
  paddingPx = 32,
): number {
  const availW = Math.max(100, canvasWidthPx - paddingPx * 2);
  const availH = Math.max(100, canvasHeightPx - paddingPx * 2);
  return Math.min(availW / hallWidthM, availH / hallHeightM);
}

/** Snap ett värde i meter till närmsta step. */
export function snap(valueM: number, stepM: number): number {
  if (stepM <= 0) return valueM;
  return Math.round(valueM / stepM) * stepM;
}

export function snapRotation(deg: number, stepDeg: number): number {
  if (stepDeg <= 0) return deg;
  return Math.round(deg / stepDeg) * stepDeg;
}

/**
 * Begränsa en position i meter så att redskapets bounding box stannar i hallen.
 * Tar hänsyn till rotation – beräknar den axel-parallella bounding-boxen (AABB)
 * för ett rektangulärt redskap med given rotation.
 */
export function clampToHall(
  xM: number,
  yM: number,
  equipmentWidthM: number,
  equipmentHeightM: number,
  hallWidthM: number,
  hallHeightM: number,
  rotationDeg = 0,
): { x: number; y: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // Axis-aligned bounding box of the rotated rectangle
  const aabbW = equipmentWidthM * cos + equipmentHeightM * sin;
  const aabbH = equipmentWidthM * sin + equipmentHeightM * cos;
  const halfW = aabbW / 2;
  const halfH = aabbH / 2;
  return {
    x: Math.min(Math.max(xM, halfW), hallWidthM - halfW),
    y: Math.min(Math.max(yM, halfH), hallHeightM - halfH),
  };
}

export function formatMeters(m: number, digits = 2): string {
  return `${m.toFixed(digits).replace(/\.?0+$/, "")} m`;
}
