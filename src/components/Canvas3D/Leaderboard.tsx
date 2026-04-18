/**
 * Leaderboard – visar live-poäng för alla spelare i rummet under tävlingsläget.
 *
 * Sorterar efter score desc; egen rad markeras med blå-ram + "Du"-badge.
 * Endast synlig när lokal spelare är i proffs-läge OCH (vi är i ett rum med
 * minst en motspelare ELLER vi är solo men i tävlingsläge — så solo-spelare
 * fortfarande ser sitt eget rekord).
 *
 * Använder Date.now() för att räkna ned remote-spelares roundEndsAt så att
 * vi visar deras kvarvarande tid utan att behöva broadcast:a det varje frame.
 */
import { useEffect, useState } from "react";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { useGameScore } from "../../store/useGameScore";
import { useGameMode } from "../../store/useGameMode";

type Row = {
  id: string;
  name: string;
  color: string;
  score: number;
  combo: number;
  roundEndsAt: number | null;
  roundActive: boolean;
  isSelf: boolean;
};

export function Leaderboard() {
  const selfId = useMultiplayerStore((s) => s.playerId);
  const selfName = useMultiplayerStore((s) => s.playerName);
  const selfColor = useMultiplayerStore((s) => s.playerColor);
  const players = useMultiplayerStore((s) => s.players);
  const score = useGameScore((s) => s.score);
  const combo = useGameScore((s) => s.combo);
  const gameMode = useGameMode((s) => s.gameMode);
  const roundState = useGameMode((s) => s.roundState);
  const roundEndsAt = useGameMode((s) => s.roundEndsAt);

  // Tickar 1× per sek så remote-timer-tal uppdateras live.
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rows: Row[] = [
    {
      id: selfId,
      name: selfName,
      color: selfColor,
      score,
      combo,
      roundEndsAt: gameMode === "tavling" ? roundEndsAt : null,
      roundActive: roundState === "running",
      isSelf: true,
    },
    ...Object.values(players).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score ?? 0,
      combo: p.combo ?? 0,
      roundEndsAt: p.roundEndsAt ?? null,
      roundActive: p.roundActive ?? false,
      isSelf: false,
    })),
  ];
  rows.sort((a, b) => b.score - a.score);

  // Visa inte om vi är ensamma och inte i tävlingsrunda — då räcker score-badge.
  const selfRoundActive = roundState === "running";
  if (rows.length <= 1 && !selfRoundActive) return null;

  const now = Date.now();

  return (
    <div style={{
      position: "absolute",
      top: 56,
      right: 12,
      width: 220,
      background: "rgba(10,18,32,0.85)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "8px 10px",
      pointerEvents: "none",
      fontFamily: "system-ui, sans-serif",
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
      zIndex: 50,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.12em",
        marginBottom: 6, display: "flex", justifyContent: "space-between",
      }}>
        <span>Topplista</span>
        <span style={{ color: "#cbd5e1" }}>{rows.length} spelare</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.slice(0, 6).map((r, idx) => {
          const secLeft = r.roundEndsAt != null
            ? Math.max(0, Math.ceil((r.roundEndsAt - now) / 1000))
            : null;
          const isLeader = idx === 0 && r.score > 0;
          return (
            <div key={r.id} style={{
              display: "grid",
              gridTemplateColumns: "16px 10px 1fr auto",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px",
              borderRadius: 6,
              background: r.isSelf
                ? "rgba(59,130,246,0.18)"
                : "rgba(255,255,255,0.04)",
              border: r.isSelf
                ? "1px solid rgba(59,130,246,0.5)"
                : "1px solid transparent",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 800,
                color: isLeader ? "#f59e0b" : "#94a3b8",
                textAlign: "center",
              }}>
                {idx + 1}
              </div>
              <div style={{
                width: 10, height: 10, borderRadius: 3,
                background: r.color,
                boxShadow: r.roundActive ? `0 0 6px ${r.color}` : "none",
              }} />
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: "#f1f5f9",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {r.name}{r.isSelf && (
                  <span style={{
                    marginLeft: 4, fontSize: 9, fontWeight: 800,
                    color: "#60a5fa", textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}>du</span>
                )}
                {secLeft != null && r.roundActive && (
                  <span style={{
                    marginLeft: 4, fontSize: 9, fontWeight: 700,
                    color: secLeft < 10 ? "#ef4444" : "#94a3b8",
                    fontVariantNumeric: "tabular-nums",
                  }}>{secLeft}s</span>
                )}
              </div>
              <div style={{
                fontSize: 13, fontWeight: 800,
                color: "#f1f5f9",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
              }}>
                {r.score.toLocaleString("sv-SE")}
                {r.combo >= 2 && (
                  <span style={{
                    marginLeft: 4, fontSize: 9, fontWeight: 800,
                    color: "#f59e0b",
                  }}>×{r.combo}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
