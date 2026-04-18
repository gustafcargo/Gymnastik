/**
 * GameHUD – overlay för spelläget.
 * Desktop: text-hints + avsluta-knapp.
 * Touch: virtuell joystick (vänster) + hoppa-upp-knapp (höger).
 */
import { useEffect, useRef, useState } from "react";
import { Camera, X, Sparkles, Volume2, VolumeX } from "lucide-react";
import type { MountedExerciseInfo } from "./GameGymnast3D";
import { GymnastStylePanel } from "./GymnastStylePanel";
import { useAudioStore } from "../../store/useAudioStore";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { isMultiplayerEnabled } from "../../lib/multiplayer";
import { RoomPanel } from "./RoomPanel";
import { InviteModal } from "./InviteModal";

type Props = {
  nearEquipment: string | null;
  mountedExerciseInfo: MountedExerciseInfo | null;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  cameraOrbitRef: React.MutableRefObject<{ yaw: number; pitch: number; distScale: number }>;
  freeCamActive: boolean;
  onExit: () => void;
};

export function GameHUD({ nearEquipment, mountedExerciseInfo, joystickRef, mountTriggerRef, speedRef, cameraResetRef, cameraOrbitRef, freeCamActive, onExit }: Props) {
  const [isTouch, setIsTouch] = useState(false);
  const [speedDisplay, setSpeedDisplay] = useState(speedRef.current);
  const [styleOpen, setStyleOpen] = useState(false);
  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggle);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  // Kamera-drag + pinch (touch)
  const camPointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);

  useEffect(() => {
    const check = () => setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    check();
    window.matchMedia("(pointer: coarse)").addEventListener("change", check);
    return () => window.matchMedia("(pointer: coarse)").removeEventListener("change", check);
  }, []);

  // Lobby-anslutning bara under spelläget. `GameHUD` mountas just då, så
  // vi använder dess livscykel som signal.
  useEffect(() => {
    if (!isMultiplayerEnabled) return;
    const mp = useMultiplayerStore.getState();
    void mp.connectLobby();
    return () => {
      void useMultiplayerStore.getState().disconnectLobby();
    };
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

  // ── Kameradrag + pinch-zoom (touch, överallt utanför joystick/knappar) ────
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const onCamDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    camPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (camPointers.current.size === 2) {
      const [a, b] = Array.from(camPointers.current.values());
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onCamMove = (e: React.PointerEvent) => {
    const prev = camPointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    camPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (camPointers.current.size === 1) {
      // Enhandsdragning → rotera kamera (yaw + pitch)
      cameraOrbitRef.current.yaw   -= dx * 0.006;
      cameraOrbitRef.current.pitch  = clamp(cameraOrbitRef.current.pitch - dy * 0.004, -0.5, 0.9);
    } else if (camPointers.current.size === 2) {
      // Tvåfingers-pinch → zoom
      const [a, b] = Array.from(camPointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistRef.current != null && pinchDistRef.current > 0) {
        const ratio = pinchDistRef.current / d; // större avstånd = mindre distScale
        cameraOrbitRef.current.distScale = clamp(cameraOrbitRef.current.distScale * ratio, 0.4, 3.5);
      }
      pinchDistRef.current = d;
    }
  };

  const onCamUp = (e: React.PointerEvent) => {
    camPointers.current.delete(e.pointerId);
    if (camPointers.current.size < 2) pinchDistRef.current = null;
  };

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, fontFamily: "system-ui, sans-serif" }}>

      {/* Touch-kamera-lager – ligger bakom alla knappar/joystick, fångar drag + pinch */}
      {isTouch && (
        <div
          onPointerDown={onCamDown}
          onPointerMove={onCamMove}
          onPointerUp={onCamUp}
          onPointerCancel={onCamUp}
          style={{
            position: "absolute", inset: 0,
            pointerEvents: "all", touchAction: "none",
            background: "transparent",
          }}
        />
      )}

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

      {/* Kamera-reset + fri kamera-indikator – övre höger under avsluta */}
      <div style={{
        position: "absolute", top: 52, right: 14,
        display: "flex", flexDirection: "column", gap: 6, pointerEvents: "all",
      }}>
        <button
          type="button"
          onClick={() => { cameraResetRef.current = true; }}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(10,18,32,0.78)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
            color: "#f1f5f9", fontSize: 11, fontWeight: 600, padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          <Camera size={13} /> Återställ kamera
        </button>
        {freeCamActive && (
          <div style={{
            background: "rgba(59,130,246,0.85)", borderRadius: 8,
            padding: "4px 10px", color: "#fff", fontSize: 10, fontWeight: 600,
            textAlign: "center",
          }}>
            Fri kamera aktiv (F)
          </div>
        )}
      </div>

      {/* Hastighetsreglage – övre höger under kameraknappar */}
      <div style={{
        position: "absolute", top: freeCamActive ? 128 : 92, right: 14,
        background: "rgba(10,18,32,0.78)", backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
        padding: "6px 10px", pointerEvents: "all", width: 140,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>
          <span>Hastighet</span>
          <span>{speedDisplay.toFixed(1)} m/s</span>
        </div>
        <input
          type="range" min={1.5} max={5} step={0.1}
          value={speedDisplay}
          onChange={(e) => { const v = Number(e.target.value); setSpeedDisplay(v); speedRef.current = v; }}
          style={{ width: "100%", accentColor: "#3B82F6", height: 4 }}
        />
      </div>

      {/* Stil-knapp – öppnar enkel färg-/glitter-editor för barn */}
      <button
        type="button"
        onClick={() => setStyleOpen(true)}
        style={{
          position: "absolute", top: freeCamActive ? 178 : 142, right: 14,
          display: "flex", alignItems: "center", gap: 6,
          background: "linear-gradient(135deg, rgba(236,72,153,0.85), rgba(168,85,247,0.85))",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8,
          color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 12px",
          cursor: "pointer", pointerEvents: "all",
          boxShadow: "0 2px 10px rgba(168,85,247,0.35)",
        }}
      >
        <Sparkles size={13} /> Stil
      </button>

      {/* Ljud-toggle – alla ljud på/av */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Slå på ljud" : "Stäng av ljud"}
        style={{
          position: "absolute", top: freeCamActive ? 214 : 178, right: 14,
          display: "flex", alignItems: "center", gap: 6,
          background: muted ? "rgba(100,116,139,0.78)" : "rgba(10,18,32,0.78)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
          color: "#f1f5f9", fontSize: 11, fontWeight: 600, padding: "6px 12px",
          cursor: "pointer", pointerEvents: "all",
        }}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        {muted ? "Ljud av" : "Ljud på"}
      </button>

      {/* Rum-panel uppe till vänster (döljs när övningsmenyn visas där) */}
      {!mountedExerciseInfo && <RoomPanel />}

      {/* Övningsmeny – visas när gymnast är monterad på redskap (uppe till vänster) */}
      {mountedExerciseInfo && (
        <div style={{
          position: "absolute", top: 14, left: 14,
          background: "rgba(10,18,32,0.88)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14,
          padding: "14px 16px", pointerEvents: "all",
          minWidth: 200, maxWidth: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Välj övning
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {mountedExerciseInfo.exercises.map((ex) => {
              const active = ex.id === mountedExerciseInfo.exerciseId;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => mountedExerciseInfo.onChange(ex.id)}
                  style={{
                    background: active ? "rgba(59,130,246,0.85)" : "rgba(255,255,255,0.07)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 8, color: active ? "#fff" : "#cbd5e1",
                    fontSize: 12, fontWeight: active ? 700 : 400,
                    padding: "7px 12px", cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  {ex.label}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#475569", textAlign: "center" }}>
            E = Nästa övning · Space = Kliv ned
          </div>
        </div>
      )}

      {/* Kontroll-hint / proximity-prompt – nedre mitt */}
      <div style={{
        position: "absolute", bottom: isTouch ? 160 : 20, left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}>
        {/* Visa inte proximity-etiketten när gymnasten är monterad */}
        {!mountedExerciseInfo && nearEquipment ? (
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
          !isTouch && !mountedExerciseInfo && (
            <div style={{
              background: "rgba(10,18,32,0.55)", backdropFilter: "blur(4px)",
              borderRadius: 16, padding: "5px 14px",
              color: "rgba(255,255,255,0.7)", fontSize: 11,
            }}>
              WASD – Flytta &nbsp;·&nbsp; Space – Hoppa upp &nbsp;·&nbsp; F – Fri kamera
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

          {/* Hoppa upp/av-knapp – nedre höger */}
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); mountTriggerRef.current = true; }}
            style={{
              position: "absolute", bottom: 40, right: 40,
              width: 80, height: 80,
              background: mountedExerciseInfo
                ? "rgba(239,68,68,0.85)"
                : nearEquipment
                  ? "rgba(59,130,246,0.85)"
                  : "rgba(34,197,94,0.85)",
              border: "2px solid rgba(255,255,255,0.30)",
              borderRadius: "50%",
              color: "#fff", fontSize: 11, fontWeight: 700,
              cursor: "pointer", pointerEvents: "all", touchAction: "none",
              transition: "background 0.2s",
              whiteSpace: "pre-line",
              lineHeight: 1.3,
            }}
          >
            {mountedExerciseInfo ? "Hoppa\nav" : nearEquipment ? "Hoppa\nupp" : "Trick"}
          </button>
        </>
      )}

      <GymnastStylePanel open={styleOpen} onClose={() => setStyleOpen(false)} />
      <InviteModal />
    </div>
  );
}
