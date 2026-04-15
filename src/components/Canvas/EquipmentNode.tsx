import { useEffect, useRef } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import { Group, Text, Transformer } from "react-konva";
import type { PlacedEquipment } from "../../types";
import { EQUIPMENT_BY_ID } from "../../catalog/equipment";
import { EquipmentVisual } from "./EquipmentVisual";
import { clampToHall, snap, snapRotation } from "../../lib/geometry";
import { usePlanStore } from "../../store/usePlanStore";

type Props = {
  equipment: PlacedEquipment;
  pxPerM: number;
  hallWidthM: number;
  hallHeightM: number;
  isSelected: boolean;
  is3D?: boolean;
  onSelect: () => void;
};

/** Bredden på text-boxen (fast pixelvärde, samma storlek oavsett skala). */
const LABEL_BOX_WIDTH = 180;
const LABEL_FONT_SIZE = 11;

export function EquipmentNode({
  equipment,
  pxPerM,
  hallWidthM,
  hallHeightM,
  isSelected,
  is3D = false,
  onSelect,
}: Props) {
  const type = EQUIPMENT_BY_ID[equipment.typeId];
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);
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
    // Skalning är inaktiverad på canvas – återställ till lagrad skala
    node.scaleX(equipment.scaleX);
    node.scaleY(equipment.scaleY);
    const rotation = snapRotation(node.rotation(), 5);
    const xM = node.x() / pxPerM;
    const yM = node.y() / pxPerM;
    transformEquipment(equipment.id, { x: xM, y: yM, rotation });
    node.rotation(rotation);
  };

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
        <EquipmentVisual
          type={type}
          widthPx={wPx}
          heightPx={hPx}
          pxPerM={pxPerM}
          isSelected={isSelected}
          is3D={is3D}
        />

        {/* Label med invers skala så texten aldrig växer/krymper */}
        <Text
          ref={textRef}
          x={wPx / 2}
          y={hPx / 2}
          offsetX={LABEL_BOX_WIDTH / 2}
          offsetY={LABEL_FONT_SIZE / 2}
          width={LABEL_BOX_WIDTH}
          align="center"
          text={equipment.label ?? type.name}
          fontSize={LABEL_FONT_SIZE}
          fontStyle="600"
          fill="#0F172A"
          shadowColor="#FFFFFF"
          shadowBlur={4}
          shadowOpacity={0.7}
          scaleX={1 / (equipment.scaleX || 1)}
          scaleY={1 / (equipment.scaleY || 1)}
          listening={false}
        />
      </Group>

      {isSelected && !is3D && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          resizeEnabled={false}
          enabledAnchors={[]}
          anchorStroke="#2563EB"
          borderStroke="#2563EB"
          borderDash={[4, 4]}
          rotateAnchorOffset={28}
        />
      )}
    </>
  );
}
