import { nanoid } from "nanoid";
import type { CustomEquipmentPart, EquipmentType } from "../types";

/**
 * Approximerar inbyggda redskap som en uppsättning CustomEquipmentPart-delar
 * så att redskapsbyggaren kan öppna dem för redigering. Delarna är inte
 * exakta kopior av 3D-modellerna — målet är att användaren ska känna igen
 * redskapets form och kunna bygga vidare.
 *
 * Koordinater:
 *   offsetX — längs hallens bredd (redskapets "bredd"-axel, w = type.widthM)
 *   offsetZ — längs djup         (redskapets "djup"-axel,  d = type.heightM)
 *   offsetY — höjd ovanför golv (underkant av delen)
 */
export function equipmentTypeToCustomParts(
  type: EquipmentType,
): CustomEquipmentPart[] {
  // Redskap som redan är uppbyggda av delar: behåll dem.
  if (type.customParts?.length) {
    return type.customParts.map((p) => ({ ...p, id: nanoid(6) }));
  }

  const kind = type.detail?.kind;
  const w = type.widthM;
  const d = type.heightM;
  const h = type.physicalHeightM;
  const color = type.color;
  const id = () => nanoid(6);

  const METAL = "#8E9AA6";
  const WOOD = "#A0703F";
  const PAD = "#D4A020";

  const mkBox = (
    ox: number,
    oy: number,
    oz: number,
    bw: number,
    bh: number,
    bd: number,
    c = color,
    rotationY?: number,
  ): CustomEquipmentPart => ({
    id: id(),
    shape: "box",
    offsetX: ox,
    offsetY: oy,
    offsetZ: oz,
    w: bw,
    h: bh,
    d: bd,
    color: c,
    ...(rotationY !== undefined ? { rotationY } : {}),
  });

  const mkCyl = (
    ox: number,
    oy: number,
    oz: number,
    diameter: number,
    bh: number,
    c = color,
    rotationY?: number,
  ): CustomEquipmentPart => ({
    id: id(),
    shape: "cylinder",
    offsetX: ox,
    offsetY: oy,
    offsetZ: oz,
    w: diameter,
    h: bh,
    d: diameter,
    color: c,
    ...(rotationY !== undefined ? { rotationY } : {}),
  });

  const mkTorus = (
    ox: number,
    oy: number,
    oz: number,
    diameter: number,
    thickness: number,
    c = color,
  ): CustomEquipmentPart => ({
    id: id(),
    shape: "torus",
    offsetX: ox,
    offsetY: oy,
    offsetZ: oz,
    w: diameter,
    h: thickness,
    d: diameter,
    color: c,
  });

  switch (kind) {
    case "parallel-bars": {
      // 4 postar + 2 räcken längs X
      const postW = 0.08;
      const railH = 0.06;
      const railY = h - railH;
      const railInsetZ = d / 2 - 0.1;
      return [
        mkBox(-w / 2 + 0.15, 0, -railInsetZ, postW, railY, postW, METAL),
        mkBox(w / 2 - 0.15, 0, -railInsetZ, postW, railY, postW, METAL),
        mkBox(-w / 2 + 0.15, 0, railInsetZ, postW, railY, postW, METAL),
        mkBox(w / 2 - 0.15, 0, railInsetZ, postW, railY, postW, METAL),
        mkBox(0, railY, -railInsetZ, w - 0.2, railH, 0.06, WOOD),
        mkBox(0, railY, railInsetZ, w - 0.2, railH, 0.06, WOOD),
      ];
    }
    case "uneven-bars": {
      const postW = 0.08;
      const highY = h - 0.06;
      const lowY = 1.75 - 0.06;
      const railInsetZ = d / 2 - 0.2;
      return [
        mkBox(-w / 2 + 0.15, 0, -railInsetZ, postW, highY, postW, METAL),
        mkBox(w / 2 - 0.15, 0, -railInsetZ, postW, highY, postW, METAL),
        mkBox(-w / 2 + 0.15, 0, railInsetZ, postW, lowY, postW, METAL),
        mkBox(w / 2 - 0.15, 0, railInsetZ, postW, lowY, postW, METAL),
        mkBox(0, highY, -railInsetZ, w - 0.2, 0.06, 0.06, WOOD),
        mkBox(0, lowY, railInsetZ, w - 0.2, 0.06, 0.06, WOOD),
      ];
    }
    case "high-bar": {
      const postW = 0.08;
      const barY = h - 0.05;
      return [
        mkBox(-w / 2 + 0.15, 0, 0, postW, barY, postW, METAL),
        mkBox(w / 2 - 0.15, 0, 0, postW, barY, postW, METAL),
        mkBox(0, barY, 0, w - 0.2, 0.05, 0.05, METAL),
      ];
    }
    case "beam": {
      // Huvudbom + två T-fötter i ändarna
      const beamH = 0.1;
      const feetH = h - beamH;
      return [
        mkBox(0, feetH, 0, w, beamH, d * 0.85, color),
        mkBox(-w / 2 + 0.08, 0, 0, 0.08, feetH, d * 0.5, METAL),
        mkBox(w / 2 - 0.08, 0, 0, 0.08, feetH, d * 0.5, METAL),
      ];
    }
    case "pommel-horse": {
      // Kropp + 2 byglar på toppen
      const bodyH = h * 0.72;
      const bodyY = h - bodyH;
      return [
        mkBox(0, bodyY, 0, w, bodyH, d, color),
        // Byglar – små uppstickande rektanglar
        mkBox(-w * 0.22, h, 0, 0.06, 0.14, d * 0.55, METAL),
        mkBox(w * 0.22, h, 0, 0.06, 0.14, d * 0.55, METAL),
        // Ben
        mkBox(-w / 2 + 0.1, 0, -d / 2 + 0.05, 0.06, bodyY, 0.06, METAL),
        mkBox(w / 2 - 0.1, 0, -d / 2 + 0.05, 0.06, bodyY, 0.06, METAL),
        mkBox(-w / 2 + 0.1, 0, d / 2 - 0.05, 0.06, bodyY, 0.06, METAL),
        mkBox(w / 2 - 0.1, 0, d / 2 - 0.05, 0.06, bodyY, 0.06, METAL),
      ];
    }
    case "rings": {
      // Frame with 2 rings hanging from top
      const postW = 0.09;
      const topH = h;
      const topBarH = 0.08;
      const ringY = h - 0.6;
      return [
        mkBox(-w / 2 + 0.2, 0, 0, postW, topH, postW, METAL),
        mkBox(w / 2 - 0.2, 0, 0, postW, topH, postW, METAL),
        mkBox(0, topH, 0, w - 0.4, topBarH, postW, METAL),
        mkTorus(-0.3, ringY, 0, 0.4, 0.04, color),
        mkTorus(0.3, ringY, 0, 0.4, 0.04, color),
      ];
    }
    case "rings-free": {
      const ringY = h - 0.3;
      return [
        mkTorus(-0.25, ringY, 0, 0.4, 0.04, color),
        mkTorus(0.25, ringY, 0, 0.4, 0.04, color),
      ];
    }
    case "vault": {
      // Bord + stolpe
      const tableH = 0.18;
      const stemH = h - tableH;
      return [
        mkBox(0, stemH, 0, w, tableH, d, color),
        mkBox(0, 0, 0, 0.12, stemH, 0.12, METAL),
      ];
    }
    case "trampette":
    case "mini-tramp": {
      // Studsbräda – tunn kropp
      return [
        mkBox(0, 0, 0, w, h * 0.9, d, color),
        // Inre studsyta – ljusare
        mkBox(0, h, 0, w * 0.75, 0.02, d * 0.75, PAD),
      ];
    }
    case "tumbling-track":
    case "air-track":
    case "floor":
    case "thick-mat":
    case "landing-mat":
    case "foam-pit": {
      return [mkBox(0, 0, 0, w, Math.max(0.05, h), d, color)];
    }
    case "plinth": {
      // 4 staplade plintdelar
      const layers = 4;
      const layerH = h / layers;
      return Array.from({ length: layers }, (_, i) => {
        const scale = 1 - i * 0.04;
        return mkBox(
          0,
          i * layerH,
          0,
          w * scale,
          layerH,
          d * scale,
          color,
        );
      });
    }
    case "buck": {
      const topH = 0.28;
      const stemH = h - topH;
      return [
        mkBox(0, stemH, 0, w, topH, d, color),
        mkBox(0, 0, 0, 0.1, stemH, 0.1, METAL),
      ];
    }
    case "wall-bars": {
      // Ribbstol: vertikal ram + horisontella ribbor
      const frameW = 0.05;
      const rungCount = 14;
      const frameRight = w / 2 - frameW / 2;
      const rungs: CustomEquipmentPart[] = [];
      for (let i = 0; i < rungCount; i += 1) {
        const y = (i + 1) * (h / (rungCount + 1));
        rungs.push(mkBox(0, y, 0, w - 0.1, 0.03, 0.03, color));
      }
      return [
        mkBox(-frameRight, 0, 0, frameW, h, d, color),
        mkBox(frameRight, 0, 0, frameW, h, d, color),
        ...rungs,
      ];
    }
    case "gym-bench": {
      // Lång bänk + två benpar
      const topH = 0.06;
      const legH = h - topH;
      return [
        mkBox(0, legH, 0, w, topH, d, color),
        mkBox(-w / 2 + 0.1, 0, 0, 0.06, legH, d * 0.85, color),
        mkBox(w / 2 - 0.1, 0, 0, 0.06, legH, d * 0.85, color),
      ];
    }
    case "climbing-rope": {
      return [mkCyl(0, 0, 0, 0.06, h, color)];
    }
    default: {
      // Okänd typ: använd grundbox sizeat efter dimensionerna
      return [
        mkBox(0, 0, 0, w, Math.max(0.1, h), d, color),
      ];
    }
  }
}
