/**
 * RoundOverlay – centrerad full-screen overlay för Tävling-läget:
 *   • Countdown 3→2→1→GO! innan rundan startar.
 *   • Persistent timer-badge under rundan (top-center, ovanför score).
 *   • Slut-scorecard när rundan slut: final score, lifetime-best-jämförelse,
 *     "Spela igen" / "Stäng".
 *
 * Komponenten driver round-state-övergångarna självt:
 *   countdown  → running  (när countdown når 0; via useFrame poll i parent)
 *   running    → ended    (när roundEndsAt passerats; här i en useEffect-loop)
 */
import { useEffect, useRef, useState } from "react";
import { useGameMode, COUNTDOWN_SEC } from "../../store/useGameMode";
import { useGameScore } from "../../store/useGameScore";
import { playCountdownTick, playRoundEnd } from "../../lib/sfx";

export function RoundOverlay() {
  const roundState = useGameMode((s) => s.roundState);
  const lastScorecard = useGameMode((s) => s.lastScorecard);

  // Tick-loop som flyttar countdown→running→ended baserat på Date.now().
  // 100ms räcker för smidigt UI utan att slösa CPU.
  const [, force] = useState(0);
  useEffect(() => {
    if (roundState === "idle" || roundState === "ended") return;
    const id = window.setInterval(() => force((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [roundState]);

  // State-övergångar från klock-beräkning.
  const lastTransitionedRef = useRef<string>("");
  // Senaste hela sek vi pingade i countdown (för att inte spela samma tick två ggr).
  const lastTickedSecRef = useRef<number>(-1);
  useEffect(() => {
    const mode = useGameMode.getState();
    if (roundState === "countdown" && mode.countdownStartedAt != null) {
      const elapsed = (Date.now() - mode.countdownStartedAt) / 1000;
      // Pinga varje hel sek (3, 2, 1) plus emfas på "GO" (sec=0).
      const left = Math.max(0, COUNTDOWN_SEC - elapsed);
      const sec = Math.ceil(left);
      if (sec !== lastTickedSecRef.current) {
        lastTickedSecRef.current = sec;
        if (sec >= 1 && sec <= COUNTDOWN_SEC) playCountdownTick(false);
        else if (sec === 0) playCountdownTick(true);
      }
      if (elapsed >= COUNTDOWN_SEC && lastTransitionedRef.current !== "started") {
        lastTransitionedRef.current = "started";
        // Reset score precis innan rundan körs igång.
        useGameScore.getState().resetScore();
        mode.beginRunning();
      }
    }
    if (roundState === "running" && mode.roundEndsAt != null && Date.now() >= mode.roundEndsAt
        && lastTransitionedRef.current !== "ended") {
      lastTransitionedRef.current = "ended";
      const score = useGameScore.getState();
      const prevBest = score.lifetimeBestTavling;
      const finalScore = score.score;
      const beat = finalScore > prevBest;
      score.commitSessionBest();
      if (beat) score.commitLifetimeBest();
      playRoundEnd();
      mode.endRound({
        finalScore,
        bestCombo: score.combo,
        beatLifetimeBest: beat,
        prevLifetimeBest: prevBest,
        endedAt: Date.now(),
      });
    }
    if (roundState === "idle") {
      lastTransitionedRef.current = "";
      lastTickedSecRef.current = -1;
    }
  });

  if (roundState === "idle") return null;

  // ── Countdown ─────────────────────────────────────────────────────────────
  if (roundState === "countdown") {
    const left = useGameMode.getState().countdownSecondsLeft();
    const num = Math.max(1, Math.ceil(left));
    const showGo = left <= 0.05;
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 220,
        display: "grid", placeItems: "center",
        background: "rgba(0,0,0,0.35)",
        pointerEvents: "none",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{
          fontSize: showGo ? 110 : 140, fontWeight: 900,
          color: showGo ? "#22c55e" : "#fff",
          textShadow: showGo
            ? "0 0 60px rgba(34,197,94,0.7), 0 6px 20px rgba(0,0,0,0.6)"
            : "0 6px 30px rgba(0,0,0,0.6)",
          letterSpacing: "0.05em",
          lineHeight: 1,
          animation: "trickPulse 0.6s ease-out",
        }}>
          {showGo ? "KÖR!" : num}
        </div>
        <style>{`
          @keyframes trickPulse {
            0% { opacity: 0; transform: scale(0.6); }
            40% { opacity: 1; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // ── Scorecard (när ended) ─────────────────────────────────────────────────
  if (roundState === "ended" && lastScorecard) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 220,
        display: "grid", placeItems: "center",
        background: "rgba(0,0,0,0.55)",
        pointerEvents: "all",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{
          background: "rgba(15,23,42,0.98)",
          border: lastScorecard.beatLifetimeBest
            ? "2px solid rgba(245,158,11,0.7)"
            : "1px solid rgba(255,255,255,0.18)",
          borderRadius: 16, padding: "28px 36px",
          color: "#f1f5f9", minWidth: 320, maxWidth: 420,
          textAlign: "center",
          boxShadow: lastScorecard.beatLifetimeBest
            ? "0 16px 60px rgba(245,158,11,0.35)"
            : "0 16px 60px rgba(0,0,0,0.6)",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: "#94a3b8",
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6,
          }}>
            Runda slut
          </div>
          {lastScorecard.beatLifetimeBest && (
            <div style={{
              fontSize: 13, fontWeight: 800,
              color: "#f59e0b", marginBottom: 12,
              textShadow: "0 0 12px rgba(245,158,11,0.5)",
            }}>
              🏆 Nytt personligt rekord!
            </div>
          )}
          <div style={{
            fontSize: 56, fontWeight: 900,
            color: "#f1f5f9",
            lineHeight: 1, marginBottom: 8,
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 4px 12px rgba(59,130,246,0.4)",
          }}>
            {lastScorecard.finalScore.toLocaleString("sv-SE")}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 22 }}>
            {lastScorecard.beatLifetimeBest
              ? <>Tidigare rekord: {lastScorecard.prevLifetimeBest.toLocaleString("sv-SE")}</>
              : <>Personligt rekord: {lastScorecard.prevLifetimeBest.toLocaleString("sv-SE")}</>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                useGameScore.getState().resetScore();
                useGameMode.getState().resetRound();
              }}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 10, padding: "11px 14px",
                color: "#cbd5e1", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Stäng
            </button>
            <button
              type="button"
              onClick={() => {
                useGameScore.getState().resetScore();
                useGameMode.getState().startCountdown();
              }}
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #f59e0b, #ea580c)",
                border: "none",
                borderRadius: 10, padding: "11px 14px",
                color: "#fff", fontSize: 13, fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(245,158,11,0.4)",
              }}
            >
              Spela igen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Round timer (under running) renderas av RoundTimer separat. ───────────
  return null;
}

export function RoundTimer() {
  const roundState = useGameMode((s) => s.roundState);
  const [, force] = useState(0);
  useEffect(() => {
    if (roundState !== "running") return;
    const id = window.setInterval(() => force((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [roundState]);

  if (roundState !== "running") return null;
  const left = useGameMode.getState().roundSecondsLeft();
  const ratio = useGameMode.getState().roundEndsAt
    ? Math.max(0, left / useGameMode.getState().roundDurationSec)
    : 0;
  const danger = left < 10;
  return (
    <div style={{
      position: "absolute", top: 56, left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(10,18,32,0.85)",
      backdropFilter: "blur(8px)",
      border: `1px solid ${danger ? "rgba(239,68,68,0.6)" : "rgba(245,158,11,0.5)"}`,
      borderRadius: 10, padding: "5px 12px",
      display: "flex", alignItems: "center", gap: 10,
      pointerEvents: "none",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: danger ? "#ef4444" : "#f59e0b",
        textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        Tid
      </div>
      <div style={{
        fontSize: 20, fontWeight: 800,
        color: "#f1f5f9", fontVariantNumeric: "tabular-nums",
        minWidth: 36, textAlign: "right",
      }}>
        {Math.ceil(left)}s
      </div>
      <div style={{
        width: 60, height: 4,
        background: "rgba(255,255,255,0.12)",
        borderRadius: 4, overflow: "hidden",
      }}>
        <div style={{
          width: `${ratio * 100}%`, height: "100%",
          background: danger
            ? "linear-gradient(90deg, #ef4444, #b91c1c)"
            : "linear-gradient(90deg, #f59e0b, #ea580c)",
          transition: "width 0.2s linear",
        }} />
      </div>
    </div>
  );
}
