/**
 * TrickOverlay – HUD-element för proffs-läget:
 *   • Score-badge överst (mittjusterad) med stora siffror + combo-multiplikator.
 *   • Timing-ring som krymper från 220px till 0px medan dt 1.5s → 0.
 *     Färgen skiftar grön → gul → röd ju närmare perfekt timing.
 *   • Toast-bubbla för senaste händelsen ("PERFEKT! Släpp! +150").
 *   • Hold-mätare när activeHold är satt (vertikal stapel som fyller mot målpoängen).
 *
 * Komponenten är ett rent HTML-overlay som monteras inuti GameHUD; den läser
 * direkt från useGameScore och behöver inga props.
 */
import { useEffect, useRef, useState } from "react";
import {
  useGameScore, comboMultiplier, GRADE_COLORS,
  HITS_TO_CLEAR, MAX_MISSES_PER_ATTEMPT,
} from "../../store/useGameScore";
import { playPerfect, playGood, playOk, playMiss, playCombo } from "../../lib/sfx";

const ringColor = (dt: number, windowMs: number) => {
  const offsetMs = Math.abs(dt) * 1000;
  if (offsetMs < windowMs * 0.4) return "#22c55e";   // grön
  if (offsetMs < windowMs * 0.9) return "#eab308";   // gul
  return "#ef4444";                                  // röd
};

export function TrickOverlay() {
  const score = useGameScore((s) => s.score);
  const combo = useGameScore((s) => s.combo);
  const lastEvent = useGameScore((s) => s.lastEvent);
  const pending = useGameScore((s) => s.pendingTrick);
  const hold = useGameScore((s) => s.activeHold);
  const currentEqId = useGameScore((s) => s.currentEqId);
  const hits = useGameScore((s) =>
    currentEqId ? s.equipmentHits[currentEqId] ?? 0 : 0,
  );
  const misses = useGameScore((s) =>
    currentEqId ? s.equipmentMisses[currentEqId] ?? 0 : 0,
  );

  const [eventVisible, setEventVisible] = useState(false);
  // Spåra senaste combo-tier så vi bara pingar när den ändras uppåt.
  // 0 = combo<2, 1=1.5×, 2=2×, 3=3×, 4=5×.
  const lastTierRef = useRef(0);
  useEffect(() => {
    if (!lastEvent) return;
    setEventVisible(true);
    // Ljud för trick-grade.
    if (lastEvent.grade === "perfect") playPerfect();
    else if (lastEvent.grade === "great") playGood();
    else if (lastEvent.grade === "good") playOk();
    else if (lastEvent.grade === "miss") playMiss();
    const id = window.setTimeout(() => setEventVisible(false), 1100);
    return () => window.clearTimeout(id);
  }, [lastEvent]);

  // Combo-ping när tier stiger.
  useEffect(() => {
    const tier = combo < 2 ? 0 : combo < 5 ? 1 : combo < 10 ? 2 : combo < 20 ? 3 : 4;
    if (tier > lastTierRef.current) playCombo(tier - 1);
    lastTierRef.current = tier;
  }, [combo]);

  const mult = comboMultiplier(combo);

  // Timing-ringen: dt går från ~1.5 (långt före) → 0 (perfekt) → −windowMs/1000 (just passerat).
  // När dt > 0 krymper ringen mot perfekt; när dt < 0 (inom toleransen) håller den minimum-storlek.
  const ringSize = pending ? Math.max(60, Math.min(220, 60 + Math.max(0, pending.dt) * 110)) : 0;
  const ringColorStr = pending ? ringColor(pending.dt, pending.windowMs) : "#22c55e";

  return (
    <>
      {/* Score-badge (top-center) */}
      <div style={{
        position: "absolute", top: 12, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(10,18,32,0.85)", backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 12, padding: "8px 16px",
        pointerEvents: "none",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Poäng
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800, color: "#f1f5f9",
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 0 10px rgba(59,130,246,0.4)",
        }}>
          {score.toLocaleString("sv-SE")}
        </div>
        {combo >= 2 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "linear-gradient(135deg, #f59e0b, #ef4444)",
            borderRadius: 8, padding: "3px 8px",
            color: "#fff", fontSize: 11, fontWeight: 800,
            boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
          }}>
            ×{mult.toString()} · {combo}
          </div>
        )}
      </div>

      {/* Progress-pill (hits/misses på aktuellt redskap) – visas bara när
          monterad. Ger spelaren klar bild av målet: X lyckade klarar,
          Y missar misslyckas. */}
      {currentEqId && (
        <div style={{
          position: "absolute", top: 58, left: "50%",
          transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(10,18,32,0.75)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: "4px 10px",
          fontSize: 11, fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
          letterSpacing: "0.03em",
        }}>
          <span style={{ color: "#22c55e" }}>
            {Math.min(hits, HITS_TO_CLEAR)}/{HITS_TO_CLEAR} <span style={{ fontSize: 9, opacity: 0.8 }}>KLARA</span>
          </span>
          <span style={{ color: "rgba(255,255,255,0.22)" }}>·</span>
          <span style={{
            color: misses >= MAX_MISSES_PER_ATTEMPT - 1 ? "#ef4444" : "#f59e0b",
          }}>
            {misses}/{MAX_MISSES_PER_ATTEMPT} <span style={{ fontSize: 9, opacity: 0.8 }}>MISS</span>
          </span>
        </div>
      )}

      {/* Toast (under progress-pillen) */}
      {lastEvent && eventVisible && (
        <div style={{
          position: "absolute", top: 92, left: "50%",
          transform: `translateX(-50%) translateY(${eventVisible ? 0 : -6}px)`,
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(10,18,32,0.92)",
          border: `1px solid ${lastEvent.grade ? GRADE_COLORS[lastEvent.grade] : "#3b82f6"}`,
          borderRadius: 10, padding: "5px 12px",
          color: "#f1f5f9", fontSize: 13, fontWeight: 700,
          pointerEvents: "none",
          opacity: eventVisible ? 1 : 0,
          transition: "opacity 0.2s, transform 0.2s",
          boxShadow: `0 4px 16px ${lastEvent.grade ? GRADE_COLORS[lastEvent.grade] + "55" : "rgba(0,0,0,0.4)"}`,
        }}>
          <span style={{ color: lastEvent.grade ? GRADE_COLORS[lastEvent.grade] : "#3b82f6" }}>
            {lastEvent.label}
          </span>
          {lastEvent.points > 0 && (
            <span style={{ color: "#94a3b8", fontWeight: 600 }}>
              +{lastEvent.points}
              {lastEvent.multiplier > 1 && (
                <span style={{ color: "#f59e0b", marginLeft: 4 }}>×{lastEvent.multiplier}</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Timing-ring (centerad på skärmen) */}
      {pending && (
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          display: "grid", placeItems: "center",
        }}>
          <svg width={240} height={240} style={{ display: "block" }}>
            {/* Yttre referensring (statisk) */}
            <circle cx={120} cy={120} r={100} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
            {/* Krympande timing-ring */}
            <circle
              cx={120} cy={120}
              r={ringSize / 2}
              fill="none"
              stroke={ringColorStr}
              strokeWidth={4}
              strokeDasharray="6 4"
              style={{ filter: `drop-shadow(0 0 8px ${ringColorStr}aa)` }}
            />
            {/* Mål-prick i mitten */}
            <circle cx={120} cy={120} r={6} fill={ringColorStr} />
          </svg>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, calc(-50% + 70px))",
            background: "rgba(10,18,32,0.85)",
            border: `1px solid ${ringColorStr}`,
            borderRadius: 8, padding: "4px 12px",
            color: "#f1f5f9", fontSize: 14, fontWeight: 800,
            letterSpacing: "0.05em", textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            {pending.label}
          </div>
        </div>
      )}

      {/* Hold-mätare (höger sida när aktiv) */}
      {hold && (
        <div style={{
          position: "absolute", left: 16, top: "50%",
          transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          background: "rgba(10,18,32,0.85)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(34,197,94,0.4)",
          borderRadius: 10, padding: "10px 8px",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            HÅLL
          </div>
          <div style={{
            position: "relative",
            width: 14, height: 140,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 8, overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: `${Math.min(100, (hold.elapsedSec / Math.max(0.001, hold.totalSec)) * 100)}%`,
              background: "linear-gradient(180deg, #22c55e, #16a34a)",
              transition: "height 0.1s linear",
            }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>
            {hold.elapsedSec.toFixed(1)}s
          </div>
          {hold.label && (
            <div style={{
              fontSize: 9, color: "#94a3b8", maxWidth: 70, textAlign: "center",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {hold.label}
            </div>
          )}
        </div>
      )}
    </>
  );
}
