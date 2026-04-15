import { Group, Line, Rect } from "react-konva";
import type { EquipmentType } from "../../../types";
import { renderEquipment } from "./equipmentVisuals";
import { darken, lighten } from "./primitives";

type Props = {
  type: EquipmentType;
  widthPx: number;
  heightPx: number;
  pxPerM: number;
  isSelected: boolean;
  /** Hur många pixlar per meter höjd ska visualiseras (Y-offset uppåt). */
  heightPxPerM: number;
};

/**
 * Pseudo-isometrisk extrudering av ett redskap. Renderar:
 *  1. En "skugga" på golvet (mörk ellips/rektangel under).
 *  2. Sido-faces (parallelogram) som visar volym/höjd.
 *  3. Topp-yta (vanliga 2D-renderaren) lyft uppåt med fysisk höjd.
 *
 * Inte true 3D – men ger tydlig känsla av höjd och tyngd i 3D-vyn.
 */
export function ExtrudedVisual({
  type,
  widthPx,
  heightPx,
  isSelected,
  heightPxPerM,
}: Props) {
  const liftPx = type.physicalHeightM * heightPxPerM;
  const cornerR = Math.min(8, Math.min(widthPx, heightPx) * 0.12);

  // Skugga slightly bredare och offsetad
  const shadowOffset = liftPx * 0.35;
  const shadow = (
    <Rect
      x={shadowOffset}
      y={shadowOffset}
      width={widthPx}
      height={heightPx}
      cornerRadius={cornerR}
      fill="#000"
      opacity={0.28}
      listening={false}
    />
  );

  // Sido-faces (höger + framsida) som parallelogram
  const sideColor = darken(type.color, 0.35);
  const frontColor = darken(type.color, 0.5);

  const sides = liftPx > 1 && (
    <Group listening={false}>
      {/* Höger-face */}
      <Line
        points={[
          widthPx,
          0,
          widthPx + liftPx * 0.5,
          -liftPx * 0.4,
          widthPx + liftPx * 0.5,
          heightPx - liftPx * 0.4,
          widthPx,
          heightPx,
        ]}
        closed
        fill={sideColor}
        stroke={darken(type.color, 0.55)}
        strokeWidth={0.6}
      />
      {/* Botten / framsida */}
      <Line
        points={[
          0,
          heightPx,
          widthPx,
          heightPx,
          widthPx + liftPx * 0.5,
          heightPx - liftPx * 0.4,
          liftPx * 0.5,
          heightPx - liftPx * 0.4,
        ]}
        closed
        fill={frontColor}
        stroke={darken(type.color, 0.55)}
        strokeWidth={0.6}
      />
      {/* Topp-rim som highlight */}
      <Line
        points={[0, 0, widthPx, 0, widthPx + liftPx * 0.5, -liftPx * 0.4]}
        stroke={lighten(type.color, 0.25)}
        strokeWidth={0.8}
      />
    </Group>
  );

  return (
    <Group>
      {shadow}
      {/* Topp-ytan lyft */}
      <Group y={-liftPx * 0.4} x={liftPx * 0.05}>
        {sides}
        <Group>
          {renderEquipment({
            type,
            w: widthPx,
            h: heightPx,
            selected: isSelected,
          })}
        </Group>
      </Group>
    </Group>
  );
}
