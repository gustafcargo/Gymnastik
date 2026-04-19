import { useCallback, useEffect, useRef, useState } from "react";
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
 * Global gate: äldre iPads (iOS Safari) tillåter ~8 live WebGL-kontexter
 * samtidigt. Paletten kan innehålla 25+ thumbnails — om alla försöker
 * mounta en `<Canvas>` samtidigt får vi null-context och three.js smäller
 * med "null is not an object (evaluating 'G.indexOf')". Vi håller därför
 * bara MAX_LIVE canvaser aktiva åt gången och köar resten.
 */
const MAX_LIVE = 2;
let active = 0;
const queue: Array<() => void> = [];

function acquireSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const release = () => {
      active = Math.max(0, active - 1);
      const next = queue.shift();
      if (next) next();
    };
    const grant = () => {
      active++;
      resolve(release);
    };
    if (active < MAX_LIVE) grant();
    else queue.push(grant);
  });
}

/**
 * En-gångs-3D-thumbnail: mountar en liten `<Canvas>`, renderar en frame,
 * snapshot:ar till dataURL och byter sedan ut canvasen mot en `<img>`.
 * Därmed håller vi aldrig mer än en handfull WebGL-kontexter live, och
 * paletten fungerar även på äldre iPad.
 */
export function Equipment3DThumbnail({ type, size, color, partColors, params }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [canMount, setCanMount] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: "80px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || dataUrl || canMount) return;
    let cancelled = false;
    acquireSlot().then((release) => {
      if (cancelled) { release(); return; }
      releaseRef.current = release;
      setCanMount(true);
    });
    return () => {
      cancelled = true;
      if (releaseRef.current) {
        releaseRef.current();
        releaseRef.current = null;
      }
    };
  }, [inView, dataUrl, canMount]);

  // Normalize model to fit a unit cube, centered at origin
  const maxFootprint = Math.max(type.widthM, type.heightM);
  const physH = Math.max(type.physicalHeightM, 0.3);
  const scale = 1 / Math.max(maxFootprint, physH * 1.4);
  const yOffset = -physH / 2;

  const camDist = 1.6;
  const camPos: [number, number, number] = [camDist, camDist * 0.85, camDist * 1.1];

  const handleCreated = useCallback(
    ({ gl, scene, camera }: { gl: any; scene: any; camera: any }) => {
      // Rendera en frame och snapshot:a. Körs i nästa microtask så
      // three.js hinner initiera alla resurser innan vi läser pixlarna.
      requestAnimationFrame(() => {
        try {
          gl.render(scene, camera);
          const url = gl.domElement.toDataURL("image/png");
          setDataUrl(url);
        } catch (err) {
          console.warn("[palette] thumbnail-snapshot misslyckades:", err);
        } finally {
          // Släpp WebGL-kontexten direkt. Canvasen avmountas när dataUrl
          // sätts (och <img> tar över), men loseContext gör att GPU-
          // minnet frigörs även om React-demounten är långsam.
          try {
            gl.getContext().getExtension("WEBGL_lose_context")?.loseContext();
            gl.dispose?.();
          } catch { /* ignoreras */ }
          if (releaseRef.current) {
            releaseRef.current();
            releaseRef.current = null;
          }
        }
      });
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, flexShrink: 0, display: "block" }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          width={size}
          height={size}
          style={{ width: size, height: size, display: "block" }}
        />
      ) : inView && canMount ? (
        <Canvas
          frameloop="demand"
          camera={{ position: camPos, fov: 38, near: 0.01, far: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "low-power",
            preserveDrawingBuffer: true,
          }}
          style={{ width: size, height: size }}
          onCreated={handleCreated}
        >
          <ambientLight intensity={0.2} />
          <directionalLight position={[3, 5, 2]} intensity={2.2} />
          <directionalLight position={[-2, 2, -1]} intensity={0.4} />
          <group scale={scale} position={[0, yOffset * scale, 0]}>
            <Equipment3D type={type} color={color} partColors={partColors} params={params} />
          </group>
        </Canvas>
      ) : null}
    </div>
  );
}
