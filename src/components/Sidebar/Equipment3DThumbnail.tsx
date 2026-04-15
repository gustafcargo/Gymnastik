import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { EquipmentType } from "../../types";
import { Equipment3D } from "../Canvas3D/Equipment3D";

type Props = {
  type: EquipmentType;
  size: number;
  color?: string;
  partColors?: Record<string, string>;
  params?: Record<string, number>;
};

/**
 * A single-render 3D thumbnail of a piece of equipment.
 * Uses IntersectionObserver to lazy-mount the WebGL Canvas only when visible.
 */
export function Equipment3DThumbnail({ type, size, color, partColors, params }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setMounted(true); },
      { rootMargin: "80px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Normalize model to fit a unit cube, centered at origin
  const maxFootprint = Math.max(type.widthM, type.heightM);
  const physH = Math.max(type.physicalHeightM, 0.3);
  // Scale so the largest dimension fits within ±0.5 (unit cube)
  const scale = 1 / Math.max(maxFootprint, physH * 1.4);
  // Shift model down so it's centred vertically
  const yOffset = -physH / 2;

  // Isometric-ish camera: positioned above-right-front
  const camDist = 1.6;
  const camPos: [number, number, number] = [camDist, camDist * 0.85, camDist * 1.1];

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, flexShrink: 0, display: "block" }}
    >
      {mounted && (
        <Canvas
          frameloop="demand"
          camera={{ position: camPos, fov: 38, near: 0.01, far: 50 }}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          style={{ width: size, height: size }}
        >
          {/* Lighting: dramatic single-source with soft fill */}
          <ambientLight intensity={0.2} />
          <directionalLight position={[3, 5, 2]} intensity={2.2} />
          <directionalLight position={[-2, 2, -1]} intensity={0.4} />

          {/* Scaled + centered model */}
          <group scale={scale} position={[0, yOffset * scale, 0]}>
            <Equipment3D type={type} color={color} partColors={partColors} params={params} />
          </group>
        </Canvas>
      )}
    </div>
  );
}
