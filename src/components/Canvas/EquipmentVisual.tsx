import { Group } from "react-konva";
import type { EquipmentType } from "../../types";
import { renderEquipment } from "./visuals/equipmentVisuals";
import { ExtrudedVisual } from "./visuals/extrudedVisual";

type Props = {
  type: EquipmentType;
  widthPx: number;
  heightPx: number;
  pxPerM: number;
  isSelected: boolean;
  is3D?: boolean;
  colorOverride?: string;
};

/**
 * Renderar ett redskap visuellt. I 2D-läge en realistisk topp-vy.
 * I 3D-läge ger den extruderade höjder + skuggor + sido-faces.
 */
export function EquipmentVisual({
  type,
  widthPx,
  heightPx,
  pxPerM,
  isSelected,
  is3D = false,
  colorOverride,
}: Props) {
  if (is3D) {
    return (
      <Group>
        <ExtrudedVisual
          type={type}
          widthPx={widthPx}
          heightPx={heightPx}
          pxPerM={pxPerM}
          heightPxPerM={pxPerM}
          isSelected={isSelected}
        />
      </Group>
    );
  }
  return (
    <Group>
      {renderEquipment({ type, w: widthPx, h: heightPx, selected: isSelected, colorOverride })}
    </Group>
  );
}
