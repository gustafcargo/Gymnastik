/**
 * EndGameSummary – sammanfattning när spelaren väljer "Avsluta spelläge".
 *
 * Används primärt i fri-läge (tävlingsläget har sin egen RoundOverlay-scorecard
 * när rundan tar slut). Visar:
 *   • rundans slutpoäng
 *   • jämförelse med personbästa (fri eller tävling beroende på gameMode)
 *   • snabbaktuell topplista om multiplayer-rum är aktivt
 *
 * Knappar:
 *   • "Spela igen" – nollställer och öppnar pre-game-menyn
 *   • "Avsluta" – stänger spelläget helt
 */
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { useGameScore } from "../../store/useGameScore";
import { useGameMode } from "../../store/useGameMode";

type Props = {
  onPlayAgain: () => void;
  onExit: () => void;
};

export function EndGameSummary({ onPlayAgain, onExit }: Props) {
  const score = useGameScore((s) => s.score);
  const combo = useGameScore((s) => s.combo);
  const lifetimeBestFri = useGameScore((s) => s.lifetimeBestFri);
  const lifetimeBestTavling = useGameScore((s) => s.lifetimeBestTavling);
  const gameMode = useGameMode((s) => s.gameMode);
  const players = useMultiplayerStore((s) => s.players);
  const selfName = useMultiplayerStore((s) => s.playerName);
  const selfColor = useMultiplayerStore((s) => s.playerColor);
  const roomCode = useMultiplayerStore((s) => s.roomCode);

  const best = gameMode === "tavling" ? lifetimeBestTavling : lifetimeBestFri;
  const beat = score > best;

  const rows = Object.values(players)
    .map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score ?? 0 }))
    .concat([{ id: "self", name: `${selfName} (du)`, color: selfColor, score }])
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const handlePlayAgain = () => {
    // Commit rekord innan reset så spelaren inte tappar den nyss spelade rundan.
    const s = useGameScore.getState();
    if (gameMode === "tavling") s.commitLifetimeBest();
    else s.commitLifetimeBestFri();
    onPlayAgain();
  };

  const handleExit = () => {
    const s = useGameScore.getState();
    if (gameMode === "tavling") s.commitLifetimeBest();
    else s.commitLifetimeBestFri();
    onExit();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 240,
        background: "rgba(7,12,22,0.92)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 18, overflowY: "auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 420,
          background: "rgba(15,23,42,0.98)",
          border: beat ? "2px solid rgba(245,158,11,0.7)" : "1px solid rgba(255,255,255,0.15)",
          borderRadius: 18, padding: "22px 22px 18px",
          color: "#f1f5f9",
          boxShadow: beat
            ? "0 16px 60px rgba(245,158,11,0.35)"
            : "0 20px 70px rgba(0,0,0,0.6)",
          textAlign: "center",
        }}
      >
        <div style={{
          fontSize: 10, fontWeight: 800, color: "#94a3b8",
          textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6,
        }}>
          Sammanfattning
        </div>

        {beat && (
          <div style={{
            fontSize: 12, fontWeight: 800,
            color: "#f59e0b", marginBottom: 10,
            textShadow: "0 0 12px rgba(245,158,11,0.5)",
          }}>
            🏆 Nytt personligt rekord!
          </div>
        )}

        <div style={{
          fontSize: 52, fontWeight: 900,
          lineHeight: 1, marginBottom: 6,
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 4px 12px rgba(59,130,246,0.4)",
        }}>
          {score.toLocaleString("sv-SE")}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>
          {beat
            ? <>Tidigare rekord: {best.toLocaleString("sv-SE")}</>
            : <>Personligt rekord: {best.toLocaleString("sv-SE")}</>}
          {combo >= 2 && <> · bästa combo ×{combo}</>}
        </div>

        {roomCode && rows.length > 1 && (
          <div style={{ textAlign: "left", marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Topplista (rum {roomCode})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {rows.map((r, i) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 8px", borderRadius: 6,
                  background: "rgba(255,255,255,0.03)",
                  fontSize: 11,
                }}>
                  <span style={{ width: 14, textAlign: "center", color: i === 0 ? "#f59e0b" : "#94a3b8", fontWeight: 800 }}>
                    {i + 1}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "#f1f5f9", fontWeight: 600 }}>{r.name}</span>
                  <span style={{ color: "#cbd5e1", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                    {r.score.toLocaleString("sv-SE")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleExit}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 10, padding: "11px 14px",
              color: "#cbd5e1", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Avsluta
          </button>
          <button
            type="button"
            onClick={handlePlayAgain}
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              border: "none",
              borderRadius: 10, padding: "11px 14px",
              color: "#fff", fontSize: 13, fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(34,197,94,0.4)",
            }}
          >
            Spela igen
          </button>
        </div>
      </div>
    </div>
  );
}
