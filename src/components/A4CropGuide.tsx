import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { a4Layout, orientationForAspect } from "../lib/a4Compose";

type Props = {
  containerRef: RefObject<HTMLElement | null>;
};

/**
 * Ritar en streckad rektangel som visar vilken del av vyn som kommer med
 * i exporten (PNG/PDF). Orienteringen följer den synliga ritytan (wider
 * than tall → liggande A4, annars stående), så ramen vrider sig med
 * enheten och matchar exakt det composeA4Page center-croppar ut.
 */
export function A4CropGuide({ containerRef }: Props) {
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
      const orient = orientationForAspect(r.width, r.height);
      const layout = a4Layout(orient);
      const contentAspect = layout.contentAspect;
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
  }, [containerRef]);

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
    />
  );
}
