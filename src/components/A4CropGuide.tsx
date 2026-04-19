import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { a4Layout, orientationForHall } from "../lib/a4Compose";
import { usePlanStore } from "../store/usePlanStore";

type Props = {
  containerRef: RefObject<HTMLElement | null>;
};

/**
 * Ritar en streckad rektangel som visar vilken del av vyn som kommer med
 * i exporten (PNG/PDF). Matchar exakt den center-crop som composeA4Page
 * gör: samma A4-orientering (landscape för breda hallar, portrait för
 * höga) och samma content-aspekt som efter marginal + header.
 */
export function A4CropGuide({ containerRef }: Props) {
  const hall = usePlanStore((s) => s.plan.hall);
  const orient = orientationForHall(hall.widthM, hall.heightM);
  const layout = a4Layout(orient);
  const contentAspect = layout.contentAspect;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const lastRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    lastRef.current = el;
    if (!el) {
      setSize(null);
      return;
    }
    const update = () => {
      const node = lastRef.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) return;
      const cAspect = r.width / r.height;
      const margin = 8; // matcha lite luft
      if (cAspect > contentAspect) {
        const h = r.height - margin * 2;
        const w = h * contentAspect;
        setSize({ w, h });
      } else {
        const w = r.width - margin * 2;
        const h = w / contentAspect;
        setSize({ w, h });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, [containerRef, contentAspect]);

  if (!size) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${size.w}px`,
        height: `${size.h}px`,
        transform: "translate(-50%, -50%)",
        border: "1.5px dashed rgba(37,99,235,0.55)",
        borderRadius: "2px",
        pointerEvents: "none",
        zIndex: 6,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -10,
          left: 8,
          transform: "translateY(-100%)",
          fontFamily: "system-ui, sans-serif",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: "rgba(37,99,235,0.95)",
          padding: "2px 6px",
          borderRadius: "4px",
          background: "rgba(255,255,255,0.9)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          whiteSpace: "nowrap",
        }}
      >
        A4 {orient === "landscape" ? "liggande" : "stående"}
      </div>
    </div>
  );
}
