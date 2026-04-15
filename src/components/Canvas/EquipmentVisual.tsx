import { Group } from "react-konva";
import type { EquipmentType } from "../../types";
import { renderEquipment } from "./visuals/equipmentVisuals";

type Props = {
  type: EquipmentType;
  widthPx: number;
  heightPx: number;
  isSelected: boolean;
};

/**
 * Realistisk topp-vy av ett redskap (utan label).
 * Varje detail.kind har en egen renderare med gradienter, lager och skuggor.
 */
export function EquipmentVisual({ type, widthPx, heightPx, isSelected }: Props) {
  return (
    <Group>
      {renderEquipment({ type, w: widthPx, h: heightPx, selected: isSelected })}
    </Group>
  );
}
