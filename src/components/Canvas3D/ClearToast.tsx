/**
 * ClearToast – positiv motpart till FailToast. Visas när spelaren klarar ett
 * redskap i proffs-läget (nådde HITS_TO_CLEAR hits på samma försök).
 *
 * Läser senaste clear-händelsen från useGameScore.lastClear. När `at` ändras
 * visas toasten i ~2.5 s. Vid "nytt bästa försök" läggs extra badge till.
 */
import { useEffect, useRef, useState } from "react";
import { useGameScore } from "../../store/useGameScore";
import { playPerfect } from "../../lib/sfx";

const TOAST_MS = 2600;

export function ClearToast() {
  const lastClear = useGameScore((s) => s.lastClear);
  const [visible, setVisible] = useState(false);
  const lastAtRef = useRef<number>(0);

  useEffect(() => {
    if (!lastClear) return;
    if (lastClear.at === lastAtRef.current) return;
    lastAtRef.current = lastClear.at;
    setVisible(true);
    playPerfect();
    const id = window.setTimeout(() => setVisible(false), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [lastClear]);

  if (!visible || !lastClear) return null;

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
        background: "linear-gradient(135deg, rgba(34,197,94,0.97), rgba(16,122,72,0.97))",
        border: "2px solid rgba(255,255,255,0.3)",
        borderRadius: 16,
        padding: "22px 32px",
        color: "#fff",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(34,197,94,0.5)",
        animation: "clearPop 0.35s ease-out",
        minWidth: 260,
      }}
    >
      <div style={{
        fontSize: 42, fontWeight: 900,
        letterSpacing: "0.08em",
        textShadow: "0 2px 10px rgba(0,0,0,0.4)",
        lineHeight: 1,
      }}>
        KLART!
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, marginTop: 6,
        opacity: 0.95,
      }}>
        {lastClear.eqName}
      </div>
      <div style={{
        fontSize: 12, fontWeight: 600, marginTop: 4,
        color: "#dcfce7",
      }}>
        +{lastClear.attemptScore.toLocaleString("sv-SE")} p
        {lastClear.isBest && lastClear.attempt > 1 ? " – nytt bästa försök" : ""}
      </div>
      {lastClear.finalAttempt && (
        <div style={{
          fontSize: 11, fontWeight: 700, marginTop: 6,
          background: "rgba(255,255,255,0.18)",
          borderRadius: 6, padding: "3px 8px",
          display: "inline-block",
        }}>
          Sista försöket på redskapet
        </div>
      )}
      <style>{`
        @keyframes clearPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          55% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
