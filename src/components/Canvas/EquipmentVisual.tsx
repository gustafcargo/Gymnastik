import { Ellipse, Group, Rect } from "react-konva";
import type { EquipmentType } from "../../types";
import { EquipmentDetailOverlay } from "./EquipmentDetail";

type Props = {
  type: EquipmentType;
  widthPx: number;
  heightPx: number;
  isSelected: boolean;
};

/**
 * Ritar ett redskaps visuella del (utan label). I kommande commits
 * byts varje redskaps-kind ut mot en mer realistisk representation
 * med gradienter, lager och skuggor.
 */
export function EquipmentVisual({ type, widthPx, heightPx, isSelected }: Props) {
  const cornerRadius = Math.min(8, Math.min(widthPx, heightPx) * 0.12);
  const stroke = isSelected ? "#0B3FA8" : "#334155";
  const strokeWidth = isSelected ? 2 : 1.2;
  const shadow = {
    shadowColor: "#0F172A",
    shadowBlur: isSelected ? 14 : 4,
    shadowOpacity: isSelected ? 0.35 : 0.15,
    shadowOffsetY: 2,
  };

  return (
    <Group>
      {type.shape === "ellipse" ? (
        <Ellipse
          x={widthPx / 2}
          y={heightPx / 2}
          radiusX={widthPx / 2}
          radiusY={heightPx / 2}
          fill={type.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          {...shadow}
        />
      ) : (
        <Rect
          width={widthPx}
          height={heightPx}
          cornerRadius={cornerRadius}
          fill={type.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          {...shadow}
        />
      )}
      <EquipmentDetailOverlay
        detail={type.detail}
        widthPx={widthPx}
        heightPx={heightPx}
      />
    </Group>
  );
}
