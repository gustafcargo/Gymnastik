import { useEffect, useRef } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { Ellipse, Group, Rect, Text, Transformer } from "react-konva";
import type { PlacedEquipment } from "../../types";
import { EQUIPMENT_BY_ID } from "../../catalog/equipment";
import { EquipmentDetailOverlay } from "./EquipmentDetail";
import { clampToHall, snap, snapRotation } from "../../lib/geometry";
import { usePlanStore } from "../../store/usePlanStore";

type Props = {
  equipment: PlacedEquipment;
  pxPerM: number;
  hallWidthM: number;
  hallHeightM: number;
  isSelected: boolean;
  onSelect: () => void;
};

export function EquipmentNode({
  equipment,
  pxPerM,
  hallWidthM,
  hallHeightM,
  isSelected,
  onSelect,
}: Props) {
  const type = EQUIPMENT_BY_ID[equipment.typeId];
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const transformEquipment = usePlanStore((s) => s.transformEquipment);
  const snapToGrid = usePlanStore((s) => s.snapToGrid);
  const snapStepM = usePlanStore((s) => s.snapStepM);

  useEffect(() => {
    if (!type) return;
    if (isSelected && groupRef.current && transformerRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, type]);

  if (!type) return null;

  const wPx = type.widthM * pxPerM;
  const hPx = type.heightM * pxPerM;

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    // Node-koordinaterna är center (pga offset); konvertera tillbaka till meter.
    const xM = node.x() / pxPerM;
    const yM = node.y() / pxPerM;
    const snappedX = snapToGrid ? snap(xM, snapStepM) : xM;
    const snappedY = snapToGrid ? snap(yM, snapStepM) : yM;
    const { x, y } = clampToHall(
      snappedX,
      snappedY,
      type.widthM * equipment.scaleX,
      type.heightM * equipment.scaleY,
      hallWidthM,
      hallHeightM,
    );
    node.position({ x: x * pxPerM, y: y * pxPerM });
    transformEquipment(equipment.id, { x, y });
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = snapRotation(node.rotation(), 5);
    const xM = node.x() / pxPerM;
    const yM = node.y() / pxPerM;
    transformEquipment(equipment.id, {
      x: xM,
      y: yM,
      scaleX: Math.max(0.3, scaleX),
      scaleY: Math.max(0.3, scaleY),
      rotation,
    });
    node.rotation(rotation);
  };

  const shape = type.shape;

  return (
    <>
      <Group
        ref={groupRef}
        x={equipment.x * pxPerM}
        y={equipment.y * pxPerM}
        rotation={equipment.rotation}
        scaleX={equipment.scaleX}
        scaleY={equipment.scaleY}
        draggable
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onMouseDown={onSelect}
        onTap={onSelect}
        onPointerDown={onSelect}
        offsetX={wPx / 2}
        offsetY={hPx / 2}
      >
        {shape === "ellipse" ? (
          <Ellipse
            x={wPx / 2}
            y={hPx / 2}
            radiusX={wPx / 2}
            radiusY={hPx / 2}
            fill={type.color}
            stroke={isSelected ? "#0B3FA8" : "#334155"}
            strokeWidth={isSelected ? 2 : 1.2}
            shadowColor="#0F172A"
            shadowBlur={isSelected ? 14 : 4}
            shadowOpacity={isSelected ? 0.35 : 0.15}
            shadowOffsetY={2}
          />
        ) : (
          <Rect
            x={0}
            y={0}
            width={wPx}
            height={hPx}
            cornerRadius={Math.min(8, Math.min(wPx, hPx) * 0.12)}
            fill={type.color}
            stroke={isSelected ? "#0B3FA8" : "#334155"}
            strokeWidth={isSelected ? 2 : 1.2}
            shadowColor="#0F172A"
            shadowBlur={isSelected ? 14 : 4}
            shadowOpacity={isSelected ? 0.35 : 0.15}
            shadowOffsetY={2}
          />
        )}

        <EquipmentDetailOverlay
          detail={type.detail}
          widthPx={wPx}
          heightPx={hPx}
        />

        <Text
          x={0}
          y={hPx / 2 - 7}
          width={wPx}
          align="center"
          text={equipment.label ?? type.name}
          fontSize={Math.max(9, Math.min(14, wPx * 0.08))}
          fontStyle="600"
          fill="#0F172A"
          listening={false}
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
          anchorSize={12}
          anchorStroke="#2563EB"
          anchorFill="#FFFFFF"
          anchorCornerRadius={4}
          borderStroke="#2563EB"
          borderDash={[4, 4]}
          rotateAnchorOffset={28}
          boundBoxFunc={(_oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) {
              return _oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}
