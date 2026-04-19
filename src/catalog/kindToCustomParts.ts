import { nanoid } from "nanoid";
import type { CustomEquipmentPart, EquipmentType } from "../types";

/**
 * Approximerar inbyggda redskap som en uppsättning CustomEquipmentPart-delar
 * så att redskapsbyggaren kan öppna dem för redigering. Delarna följer
 * Equipment3D:s verkliga geometri så noggrant som möjligt, inom ramen för
 * vad CustomEquipmentPart stödjer (axelriktade boxar + upprätta cylindrar/
 * koner/sfärer samt horisontella torusringar). Diagonala vajrar och
 * lutande element utelämnas eller approximeras som boxar.
 *
 * Koordinater:
 *   offsetX — längs hallens bredd (redskapets "bredd"-axel, w = type.widthM)
 *   offsetZ — längs djup         (redskapets "djup"-axel,  d = type.heightM)
 *   offsetY — höjd ovanför golv (underkant av delen)
 */
export function equipmentTypeToCustomParts(
  type: EquipmentType,
): CustomEquipmentPart[] {
  if (type.customParts?.length) {
    return type.customParts.map((p) => ({ ...p, id: nanoid(6) }));
  }

  const kind = type.detail?.kind;
  const w = type.widthM;
  const d = type.heightM;
  const h = type.physicalHeightM;
  const color = type.color;
  const id = () => nanoid(6);

  const METAL = "#CDD2DA";
  const METAL_DARK = "#5A6270";
  const BASE_DARK = "#252D3A";
  const WOOD = "#A0703F";
  const PAD_LEATHER = "#A07848";
  const RUBBER = "#2A2A2A";

  const mkBox = (
    ox: number,
    oy: number,
    oz: number,
    bw: number,
    bh: number,
    bd: number,
    c = color,
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
  });

  const mkCyl = (
    ox: number,
    oy: number,
    oz: number,
    diameter: number,
    bh: number,
    c = color,
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
    d: thickness * 4,
    color: c,
  });

  const mkCone = (
    ox: number,
    oy: number,
    oz: number,
    diameter: number,
    bh: number,
    c = color,
  ): CustomEquipmentPart => ({
    id: id(),
    shape: "cone",
    offsetX: ox,
    offsetY: oy,
    offsetZ: oz,
    w: diameter,
    h: bh,
    d: diameter,
    color: c,
  });

  switch (kind) {
    case "parallel-bars": {
      const baseH = 0.04;
      const barLen = Math.min(w * 0.76, 2.4);
      const railSpacing = 0.42;
      const postXs = [-barLen / 2 + 0.06, barLen / 2 - 0.06];
      const zs = [-railSpacing / 2, railSpacing / 2];
      const parts: CustomEquipmentPart[] = [];
      for (const z of zs) {
        for (const x of postXs) {
          parts.push(mkBox(x, 0, z, 0.35, baseH, 0.42, BASE_DARK));
          parts.push(mkCyl(x, baseH, z, 0.076, h - baseH, METAL));
        }
        parts.push(mkBox(0, 0.32, z, barLen - 0.2, 0.032, 0.032, METAL));
        parts.push(mkBox(0, h - 0.044, z, barLen, 0.044, 0.044, WOOD));
      }
      return parts;
    }

    case "uneven-bars": {
      const baseH = 0.04;
      const highBarH = Math.max(h, 2.55);
      const lowBarH = 1.75;
      const barSep = 1.4;
      const barLen = Math.min(w * 0.88, 2.4);
      const postXs = [-barLen / 2 + 0.06, barLen / 2 - 0.06];
      const parts: CustomEquipmentPart[] = [];
      for (const x of postXs) {
        parts.push(mkBox(x, 0, -barSep / 2, 0.32, baseH, 0.55, BASE_DARK));
        parts.push(mkBox(x, 0, barSep / 2, 0.32, baseH, 0.55, BASE_DARK));
        parts.push(mkCyl(x, baseH, -barSep / 2, 0.072, highBarH, METAL));
        parts.push(mkCyl(x, baseH, barSep / 2, 0.072, lowBarH, METAL));
      }
      parts.push(mkBox(0, highBarH + baseH - 0.028, -barSep / 2, barLen, 0.028, 0.028, METAL));
      parts.push(mkBox(0, lowBarH + baseH - 0.028, barSep / 2, barLen, 0.028, 0.028, METAL));
      return parts;
    }

    case "high-bar": {
      const baseH = 0.04;
      const barH = Math.max(h, 2.75);
      const xPost = Math.min(w * 0.44, 0.88);
      const baseD = Math.min(d * 0.8, 1.1);
      return [
        mkBox(-xPost, 0, 0, 0.45, baseH, baseD, BASE_DARK),
        mkBox(xPost, 0, 0, 0.45, baseH, baseD, BASE_DARK),
        mkCyl(-xPost, baseH, 0, 0.088, barH, METAL),
        mkCyl(xPost, baseH, 0, 0.088, barH, METAL),
        mkBox(-xPost, barH + baseH, 0, 0.08, 0.055, 0.055, METAL_DARK),
        mkBox(xPost, barH + baseH, 0, 0.08, 0.055, 0.055, METAL_DARK),
        mkBox(0, barH + baseH - 0.028, 0, 2.4, 0.028, 0.028, METAL),
      ];
    }

    case "beam": {
      const beamH = h;
      const beamWidth = 0.1;
      const bodyH = 0.08;
      const topH = 0.05;
      const postX = w * 0.36;
      const tBar = 0.7;
      const pedestalH = beamH - topH - bodyH;
      const parts: CustomEquipmentPart[] = [];
      for (const x of [-postX, postX]) {
        parts.push(mkBox(x, 0, 0, 0.06, 0.035, tBar * 2, METAL_DARK));
        parts.push(mkBox(x, 0, -tBar + 0.05, 0.12, 0.014, 0.18, "#EEEEEE"));
        parts.push(mkBox(x, 0, tBar - 0.05, 0.12, 0.014, 0.18, "#EEEEEE"));
        parts.push(mkCyl(x, 0.035, 0, 0.072, pedestalH * 0.8, color));
        parts.push(mkCyl(x, 0.035 + pedestalH * 0.58, 0, 0.056, pedestalH * 0.44, color));
        parts.push(mkBox(x, pedestalH, 0, 0.15, 0.056, 0.14, METAL_DARK));
      }
      parts.push(mkBox(0, pedestalH + 0.056, 0, w, bodyH, beamWidth * 1.15, "#4A2810"));
      parts.push(mkBox(0, beamH - topH, 0, w - 0.02, topH, beamWidth, "#B8875A"));
      return parts;
    }

    case "pommel-horse": {
      const standH = 0.87;
      const bodyLen = 1.6;
      const bodyW = 0.35;
      const bodyH = 0.28;
      const legH = standH - bodyH;
      const legXs = [-bodyLen * 0.38, bodyLen * 0.38];
      const legZs = [-bodyW * 0.4, bodyW * 0.4];
      const handleSpacing = 0.42;
      const riseH = 0.12;
      const arcR = 0.072;
      const parts: CustomEquipmentPart[] = [];
      for (const x of legXs) {
        for (const z of legZs) {
          parts.push(mkBox(x, 0, z, 0.24, 0.036, 0.3, BASE_DARK));
          parts.push(mkCyl(x, 0.036, z, 0.044, legH - 0.036, METAL));
        }
      }
      parts.push(mkBox(0, legH, 0, bodyLen, bodyH, bodyW, color));
      parts.push(mkBox(0, standH, 0, bodyLen - 0.04, 0.01, bodyW - 0.02, PAD_LEATHER));
      for (const px of [-handleSpacing / 2, handleSpacing / 2]) {
        parts.push(mkCyl(px, standH, -arcR, 0.036, riseH, METAL));
        parts.push(mkCyl(px, standH, arcR, 0.036, riseH, METAL));
        parts.push(mkBox(px, standH + riseH - 0.036, 0, 0.036, 0.036, arcR * 2, METAL));
      }
      return parts;
    }

    case "rings": {
      const ringH = h;
      const frameH = Math.max(ringH + 2.8, 5.5);
      const xPost = 0.34;
      const ringSpacing = 0.25;
      const ringR = 0.09;
      const strapH = Math.max(0.1, ringH - 0.2);
      return [
        mkBox(0, 0, 0, xPost * 2 + 0.3, 0.05, 0.55, "#8B3030"),
        mkCyl(-xPost, 0.05, 0, 0.072, frameH - 0.05, "#8B3030"),
        mkCyl(xPost, 0.05, 0, 0.072, frameH - 0.05, "#8B3030"),
        mkBox(0, frameH - 0.044, 0, xPost * 2, 0.044, 0.044, "#8B3030"),
        mkBox(0, frameH - 0.11, 0, 0.12, 0.06, 0.06, "#444"),
        mkBox(-ringSpacing, ringH + ringR, 0, 0.03, strapH, 0.014, "#6B4A2A"),
        mkBox(ringSpacing, ringH + ringR, 0, 0.03, strapH, 0.014, "#6B4A2A"),
        mkTorus(-ringSpacing, ringH - ringR, 0, ringR * 2, 0.028, color),
        mkTorus(ringSpacing, ringH - ringR, 0, ringR * 2, 0.028, color),
      ];
    }

    case "rings-free": {
      const ringH = h;
      const ringR = 0.09;
      const ringSpacing = 0.25;
      const strapH = Math.max(0.1, ringH - 0.2);
      return [
        mkBox(-ringSpacing, ringH + ringR, 0, 0.03, strapH, 0.014, "#6B4A2A"),
        mkBox(ringSpacing, ringH + ringR, 0, 0.03, strapH, 0.014, "#6B4A2A"),
        mkTorus(-ringSpacing, ringH - ringR, 0, ringR * 2, 0.028, color),
        mkTorus(ringSpacing, ringH - ringR, 0, ringR * 2, 0.028, color),
      ];
    }

    case "vault": {
      const standH = 1.12;
      const padH = 0.22;
      const baseH = 0.055;
      const capH = 0.038;
      const baseW = Math.min(w * 0.92, 0.86);
      const baseD = Math.min(d * 0.78, 0.95);
      const colW = Math.min(w * 0.44, 0.44);
      const colD = Math.min(d * 0.4, 0.5);
      const parts: CustomEquipmentPart[] = [
        mkBox(0, 0, 0, baseW, baseH, baseD, METAL_DARK),
      ];
      for (const px of [-baseW / 2 + 0.07, baseW / 2 - 0.07]) {
        for (const pz of [-baseD / 2 + 0.07, baseD / 2 - 0.07]) {
          parts.push(mkCyl(px, 0, pz, 0.092, 0.024, "#B81818"));
        }
      }
      parts.push(mkBox(0, baseH, 0, colW, standH, colD, METAL_DARK));
      parts.push(mkBox(0, baseH + standH * 0.5 - 0.026, 0, colW + 0.022, 0.052, colD + 0.022, "#28303E"));
      parts.push(mkBox(0, baseH + standH, 0, w * 0.82, capH, d * 0.82, METAL_DARK));
      parts.push(mkBox(0, baseH + standH + capH, 0, w, padH, d, color));
      parts.push(mkBox(0, baseH + standH + capH + padH, 0, w - 0.012, 0.015, d - 0.012, "#B84010"));
      return parts;
    }

    case "trampette": {
      const baseH = 0.045;
      const springH = 0.16;
      const padH = 0.075;
      const parts: CustomEquipmentPart[] = [
        mkBox(0, 0, 0, w * 0.96, baseH, d * 0.96, "#C8A060"),
        mkBox(-w / 2 + 0.015, 0, 0, 0.025, baseH + springH + padH, d * 0.96, "#2A2A2A"),
        mkBox(w / 2 - 0.015, 0, 0, 0.025, baseH + springH + padH, d * 0.96, "#2A2A2A"),
      ];
      for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5;
        const pz = -d * 0.42 + t * d * 0.84;
        parts.push(mkCyl(0, baseH, pz, 0.07, springH, "#4A4A4A"));
      }
      parts.push(mkBox(0, baseH + springH, 0, w * 0.93, padH, d * 0.9, color ?? "#E06020"));
      return parts;
    }

    case "mini-tramp": {
      const deviceH = 0.28;
      const frameT = 0.028;
      const frameH = 0.056;
      const padH = 0.038;
      const parts: CustomEquipmentPart[] = [];
      for (const cx of [-w / 2, w / 2]) {
        for (const cz of [-d / 2, d / 2]) {
          parts.push(mkCyl(cx, 0, cz, 0.036, deviceH, "#5A6272"));
          parts.push(mkCyl(cx, 0, cz, 0.06, 0.018, "#C01818"));
        }
      }
      parts.push(mkBox(0, deviceH * 0.42, -d / 2, w, frameT * 1.7, frameT * 1.7, "#5A6272"));
      parts.push(mkBox(0, deviceH * 0.42, d / 2, w, frameT * 1.7, frameT * 1.7, "#5A6272"));
      parts.push(mkBox(0, deviceH - frameH / 2, -d / 2 + frameT / 2, w, frameH, frameT, "#3A4050"));
      parts.push(mkBox(0, deviceH - frameH / 2, d / 2 - frameT / 2, w, frameH, frameT, "#3A4050"));
      parts.push(mkBox(-w / 2 + frameT / 2, deviceH - frameH / 2, 0, frameT, frameH, d, "#3A4050"));
      parts.push(mkBox(w / 2 - frameT / 2, deviceH - frameH / 2, 0, frameT, frameH, d, "#3A4050"));
      parts.push(mkBox(0, deviceH + frameH * 0.05, 0, w - frameT * 2, padH, d - frameT * 2, color ?? "#B02020"));
      return parts;
    }

    case "tumbling-track": {
      const th = Math.max(0.08, h);
      return [
        mkBox(0, 0, 0, w, th, d, color ?? "#4A7A3A"),
        mkBox(0, th, -d / 2 + 0.04, w - 0.1, 0.005, 0.025, "#FFFFFF"),
        mkBox(0, th, d / 2 - 0.04, w - 0.1, 0.005, 0.025, "#FFFFFF"),
      ];
    }

    case "air-track": {
      const th = Math.max(0.1, h);
      return [
        mkBox(0, 0, 0, w, th, d, color ?? "#2878C0"),
        mkBox(0, th, 0, w * 0.6, 0.005, d * 0.3, "#1A5A9A"),
      ];
    }

    case "floor": {
      const fh = 0.1;
      const border = Math.min(w, d) * 0.083;
      const innerW = w - border * 2;
      const innerD = d - border * 2;
      return [
        mkBox(0, 0, 0, w, fh, d, color ?? "#1A50C0"),
        mkBox(0, fh, 0, innerW, 0.006, innerD, "#CC2828"),
        mkBox(-innerW / 2, fh + 0.006, 0, 0.05, 0.004, innerD + 0.05, "#FFFFFF"),
        mkBox(innerW / 2, fh + 0.006, 0, 0.05, 0.004, innerD + 0.05, "#FFFFFF"),
        mkBox(0, fh + 0.006, -innerD / 2, innerW + 0.05, 0.004, 0.05, "#FFFFFF"),
        mkBox(0, fh + 0.006, innerD / 2, innerW + 0.05, 0.004, 0.05, "#FFFFFF"),
      ];
    }

    case "thick-mat":
    case "landing-mat":
    case "foam-pit": {
      return [mkBox(0, 0, 0, w, Math.max(0.06, h), d, color)];
    }

    case "plinth": {
      const layers = 4;
      const layerH = h / layers;
      return Array.from({ length: layers }, (_, i) => {
        const shrink = 1 - i * 0.035;
        return mkBox(0, i * layerH, 0, w * shrink, layerH * 0.94, d * shrink, color);
      });
    }

    case "buck": {
      const totalH = h;
      const bodyH = Math.max(0.1, totalH - 0.18);
      return [
        mkCyl(0, 0, 0, 0.13, bodyH, METAL),
        mkBox(0, bodyH, 0, w * 0.55, 0.02, 0.3, BASE_DARK),
        mkBox(0, totalH - 0.22, 0, Math.max(0.3, w * 0.65) + 0.28, 0.28, 0.28, color),
      ];
    }

    case "wall-bars": {
      const depth = 0.06;
      const upW = 0.045;
      const nRungs = 10;
      const rungSpacing = (h - 0.12) / (nRungs - 1);
      const parts: CustomEquipmentPart[] = [
        mkBox(0, 0, -(depth / 2 + 0.02), w + 0.04, h, 0.04, "#8C7060"),
        mkBox(-w / 2 + upW / 2, 0, 0, upW, h, depth, color),
        mkBox(w / 2 - upW / 2, 0, 0, upW, h, depth, color),
      ];
      for (let i = 0; i < nRungs; i++) {
        const y = 0.06 + i * rungSpacing - 0.018;
        parts.push(mkBox(0, y, 0, w - upW * 2, 0.036, 0.036, "#C8904A"));
      }
      return parts;
    }

    case "gym-bench": {
      const boardT = 0.036;
      const boardD = 0.26;
      const legH = 0.28;
      const legT = 0.03;
      const footSpread = 0.06;
      const parts: CustomEquipmentPart[] = [
        mkBox(0, legH, 0, w, boardT, boardD, color),
      ];
      for (const px of [-w / 2 + legT / 2, w / 2 - legT / 2]) {
        for (const pz of [-boardD / 2 - footSpread + legT, boardD / 2 + footSpread - legT]) {
          parts.push(mkBox(px, 0, pz, legT, legH, legT, "#B8923A"));
          parts.push(mkBox(px, 0, pz, 0.08, 0.016, 0.06, RUBBER));
        }
        parts.push(mkBox(px, legH * 0.38, 0, legT, legT, boardD + footSpread * 2, "#B8923A"));
      }
      return parts;
    }

    case "climbing-rope": {
      return [
        mkCyl(0, h, 0, 0.1, 0.08, "#3A3A3A"),
        mkTorus(0, h, 0, 0.09, 0.024, "#3A3A3A"),
        mkCyl(0, 0.08, 0, 0.06, h - 0.08, color ?? "#8B6A3A"),
        mkCone(0, 0, 0, 0.096, 0.08, color ?? "#8B6A3A"),
      ];
    }

    default: {
      return [mkBox(0, 0, 0, w, Math.max(0.1, h), d, color)];
    }
  }
}
