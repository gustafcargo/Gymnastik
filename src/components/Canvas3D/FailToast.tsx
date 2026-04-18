/**
 * FailToast – stor central banner som visas när spelaren fått två missar på
 * samma redskap i proffs-läge. Informerar om rollback av poäng och att
 * redskapet är låst för resten av detta game.
 *
 * Läser senaste fail-händelsen direkt från useGameScore.lastFail. När `at`
 * ändras visas toasten i ~2.5 sekunder och fade:ar sedan ut. Komponenten
 * är passiv (ingen click-hantering) och renderas inuti GameHUD.
 */
import { useEffect, useRef, useState } from "react";
import { useGameScore } from "../../store/useGameScore";
import { playMiss } from "../../lib/sfx";

const TOAST_MS = 2600;

export function FailToast() {
  const lastFail = useGameScore((s) => s.lastFail);
  const [visible, setVisible] = useState(false);
  const lastAtRef = useRef<number>(0);

  useEffect(() => {
    if (!lastFail) return;
    if (lastFail.at === lastAtRef.current) return;
    lastAtRef.current = lastFail.at;
    setVisible(true);
    playMiss();
    const id = window.setTimeout(() => setVisible(false), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [lastFail]);

  if (!visible || !lastFail) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 250,
        pointerEvents: "none",
        fontFamily: "system-ui, sans-serif",
        background: "linear-gradient(135deg, rgba(220,38,38,0.97), rgba(153,27,27,0.97))",
        border: "2px solid rgba(255,255,255,0.3)",
        borderRadius: 16,
        padding: "22px 32px",
        color: "#fff",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(220,38,38,0.5)",
        animation: "failPop 0.35s ease-out",
        minWidth: 260,
      }}
    >
      <div style={{
        fontSize: 42, fontWeight: 900,
        letterSpacing: "0.08em",
        textShadow: "0 2px 10px rgba(0,0,0,0.4)",
        lineHeight: 1,
      }}>
        FAIL!
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, marginTop: 6,
        opacity: 0.95,
      }}>
        {lastFail.eqName} är låst
      </div>
      {lastFail.rollbackPoints > 0 && (
        <div style={{
          fontSize: 12, fontWeight: 600, marginTop: 4,
          color: "#fecaca",
        }}>
          −{lastFail.rollbackPoints.toLocaleString("sv-SE")} p från redskapet
        </div>
      )}
      <style>{`
        @keyframes failPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          55% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
