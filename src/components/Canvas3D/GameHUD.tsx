/**
 * GameHUD – overlay för spelläget.
 * Desktop: text-hints + avsluta-knapp.
 * Touch: virtuell joystick (vänster) + hoppa-upp-knapp (höger).
 */
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import type { MountedExerciseInfo } from "./GameGymnast3D";
import type { AgeGroup } from "../../store/usePlanStore";

export type Mission = {
  id: string;
  text: string;
  target: number;
  progress: number;
  done: boolean;
  type: "mount" | "cycle" | "score" | "different-equipment";
};

type Props = {
  nearEquipment: string | null;
  mountedExerciseInfo: MountedExerciseInfo | null;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  freeCamActive: boolean;
  score: number;
  streak: number;
  missions: Mission[];
  ageGroup: AgeGroup;
  onExit: () => void;
};

export function GameHUD({ nearEquipment, mountedExerciseInfo, joystickRef, mountTriggerRef, speedRef, cameraResetRef, freeCamActive, score, streak, missions, ageGroup, onExit }: Props) {
  const [isTouch, setIsTouch] = useState(false);
  const [speedDisplay, setSpeedDisplay] = useState(speedRef.current);
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

      {/* Poäng + streak – övre mitt */}
      <div style={{
        position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 8, pointerEvents: "none",
      }}>
        <div style={{
          background: "rgba(10,18,32,0.78)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
          padding: "6px 14px", color: "#FFD700",
          fontSize: 16, fontWeight: 900,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          ⭐ <span>{score}</span>
        </div>
        {streak >= 3 && (
          <div style={{
            background: streak >= 5 ? "rgba(239,68,68,0.88)" : "rgba(249,115,22,0.88)",
            borderRadius: 10, padding: "6px 12px",
            color: "#fff", fontSize: 13, fontWeight: 800,
          }}>
            🔥 {streak} i rad!
          </div>
        )}
      </div>

      {/* Missions – övre vänster (under övningsmenyn om monterad) */}
      {missions.length > 0 && (
        <div style={{
          position: "absolute",
          top: mountedExerciseInfo ? 14 + 50 + missions.filter(m => !m.done).length * 0 + 200 : 14,
          left: 14,
          pointerEvents: "none",
          display: "flex", flexDirection: "column", gap: 5,
          maxWidth: 240,
        }}>
          {!mountedExerciseInfo && missions.map((m) => (
            <div key={m.id} style={{
              background: m.done ? "rgba(16,185,129,0.85)" : "rgba(10,18,32,0.78)",
              backdropFilter: "blur(6px)",
              border: `1px solid ${m.done ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 8, padding: "6px 10px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{m.done ? "✅" : "⬜"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: m.done ? "#fff" : "#e2e8f0", lineHeight: 1.3 }}>{m.text}</div>
                {!m.done && (
                  <div style={{ marginTop: 3, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: "#3B82F6",
                      width: `${Math.round((m.progress / m.target) * 100)}%`,
                      transition: "width 0.3s",
                    }} />
                  </div>
                )}
              </div>
              {!m.done && (
                <span style={{ fontSize: 10, color: "#64748b", flexShrink: 0 }}>{m.progress}/{m.target}</span>
              )}
            </div>
          ))}
        </div>
      )}

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
