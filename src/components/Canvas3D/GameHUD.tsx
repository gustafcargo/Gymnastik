/**
 * GameHUD – overlay för spelläget.
 * Desktop: text-hints + avsluta-knapp.
 * Touch: virtuell joystick (vänster) + hoppa-upp-knapp (höger).
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  nearEquipment: string | null;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  onExit: () => void;
};

export function GameHUD({ nearEquipment, joystickRef, mountTriggerRef, onExit }: Props) {
  const [isTouch, setIsTouch] = useState(false);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    check();
    window.matchMedia("(pointer: coarse)").addEventListener("change", check);
    return () => window.matchMedia("(pointer: coarse)").removeEventListener("change", check);
  }, []);

  // ── Joystick-logik ──────────────────────────────────────────────────────────
  const onJoyDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const onJoyMove = (e: React.PointerEvent) => {
    if (joyPointerId.current !== e.pointerId || !joyOrigin.current) return;
    const maxR = 40;
    let dx = e.clientX - joyOrigin.current.x;
    let dz = e.clientY - joyOrigin.current.y;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > maxR) { dx = dx / len * maxR; dz = dz / len * maxR; }
    joystickRef.current = { dx: dx / maxR, dz: dz / maxR };
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(${dx}px, ${dz}px)`;
    }
  };

  const onJoyUp = (e: React.PointerEvent) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    joyOrigin.current = null;
    joystickRef.current = { dx: 0, dz: 0 };
    if (joyKnobRef.current) joyKnobRef.current.style.transform = "translate(0,0)";
  };

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, fontFamily: "system-ui, sans-serif" }}>

      {/* Avsluta-knapp – övre höger */}
      <button
        type="button"
        onClick={onExit}
        style={{
          position: "absolute", top: 14, right: 14,
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(10,18,32,0.78)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
          color: "#f1f5f9", fontSize: 12, fontWeight: 600, padding: "6px 12px",
          cursor: "pointer", pointerEvents: "all",
        }}
      >
        <X size={14} /> Avsluta spelläge
      </button>

      {/* Kontroll-hint / proximity-prompt – nedre mitt */}
      <div style={{
        position: "absolute", bottom: isTouch ? 160 : 20, left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}>
        {nearEquipment ? (
          <div style={{
            background: "rgba(59,130,246,0.85)", backdropFilter: "blur(6px)",
            borderRadius: 20, padding: "7px 18px",
            color: "#fff", fontSize: 13, fontWeight: 600,
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}>
            {isTouch ? `👆 Hoppa upp på ${nearEquipment}` : `[Space] Hoppa upp på ${nearEquipment}`}
          </div>
        ) : (
          !isTouch && (
            <div style={{
              background: "rgba(10,18,32,0.55)", backdropFilter: "blur(4px)",
              borderRadius: 16, padding: "5px 14px",
              color: "rgba(255,255,255,0.7)", fontSize: 11,
            }}>
              WASD / Piltangenter – Flytta &nbsp;·&nbsp; Space – Hoppa upp
            </div>
          )
        )}
      </div>

      {/* Touch-kontroller */}
      {isTouch && (
        <>
          {/* Joystick – nedre vänster */}
          <div
            onPointerDown={onJoyDown}
            onPointerMove={onJoyMove}
            onPointerUp={onJoyUp}
            style={{
              position: "absolute", bottom: 40, left: 40,
              width: 100, height: 100,
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.25)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "all", touchAction: "none",
            }}
          >
            <div ref={joyKnobRef} style={{
              width: 44, height: 44,
              background: "rgba(255,255,255,0.45)",
              borderRadius: "50%",
              transition: "none",
            }} />
          </div>

          {/* Hoppa upp-knapp – nedre höger */}
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); mountTriggerRef.current = true; }}
            style={{
              position: "absolute", bottom: 40, right: 40,
              width: 80, height: 80,
              background: nearEquipment ? "rgba(59,130,246,0.85)" : "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.30)",
              borderRadius: "50%",
              color: "#fff", fontSize: 11, fontWeight: 700,
              cursor: "pointer", pointerEvents: "all", touchAction: "none",
              transition: "background 0.2s",
            }}
          >
            {nearEquipment ? "Hoppa\nupp" : "–"}
          </button>
        </>
      )}
    </div>
  );
}
