/**
 * EndGameSummary – sammanfattning när spelaren väljer "Avsluta spelläge".
 *
 * I proffs-läget (svår/tävling) visas en mer omfattande scorecard:
 *   • totalpoäng + ev. jämförelse mot personbästa
 *   • per redskap: spelarens bästa clear-poäng + ev. placering i rummet
 *   • totalplacering i rummet om multiplayer är aktivt
 *
 * I nybörjarläget visas bara slutpoäng + topplista (som tidigare).
 */
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { useGameScore } from "../../store/useGameScore";
import { useGameMode } from "../../store/useGameMode";
import { useGameConfig, isProffsMode } from "../../store/useGameConfig";
import { PROFFS_STATION } from "../../catalog/proffsArena";
import { getEquipmentById } from "../../catalog/equipment";

type Props = {
  onPlayAgain: () => void;
  onExit: () => void;
};

type PlayerRow = {
  id: string;
  name: string;
  color: string;
  isSelf: boolean;
  total: number;
  perEq: Record<string, number>;
  failedEq: Set<string>;
};

function rankSuffix(n: number): string {
  // Svensk ordningstal: 1:a, 2:a, 3:e, 4:e, ...
  if (n === 1 || n === 2) return `${n}:a`;
  return `${n}:e`;
}

export function EndGameSummary({ onPlayAgain, onExit }: Props) {
  const score = useGameScore((s) => s.score);
  const combo = useGameScore((s) => s.combo);
  const equipmentBestClear = useGameScore((s) => s.equipmentBestClear);
  const failedEquipment = useGameScore((s) => s.failedEquipment);
  const lifetimeBestFri = useGameScore((s) => s.lifetimeBestFri);
  const lifetimeBestTavling = useGameScore((s) => s.lifetimeBestTavling);
  const gameMode = useGameMode((s) => s.gameMode);
  const difficulty = useGameConfig((s) => s.difficulty);
  const players = useMultiplayerStore((s) => s.players);
  const selfId = useMultiplayerStore((s) => s.playerId);
  const selfName = useMultiplayerStore((s) => s.playerName);
  const selfColor = useMultiplayerStore((s) => s.playerColor);
  const roomCode = useMultiplayerStore((s) => s.roomCode);

  const inProffs = isProffsMode(difficulty);

  const best = gameMode === "tavling" ? lifetimeBestTavling : lifetimeBestFri;
  const beat = score > best;

  // Samla rader: alla remote-spelare + jag själv. I proffs-läget ingår
  // per-redskap-data som skickas via multiplayer-broadcast.
  const remoteRows: PlayerRow[] = Object.values(players).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isSelf: false,
    total: p.score ?? 0,
    perEq: p.equipmentBestClear ?? {},
    failedEq: new Set(p.failedEquipment ?? []),
  }));
  const selfRow: PlayerRow = {
    id: selfId || "self",
    name: `${selfName} (du)`,
    color: selfColor,
    isSelf: true,
    total: score,
    perEq: equipmentBestClear,
    failedEq: new Set(failedEquipment),
  };
  const allRows: PlayerRow[] = [...remoteRows, selfRow];
  const multiplayerActive = Boolean(roomCode) && allRows.length > 1;

  // Totalplacering (sortering desc)
  const totalRanking = [...allRows].sort((a, b) => b.total - a.total);
  const selfTotalRank =
    totalRanking.findIndex((r) => r.isSelf) + 1;

  // Per-redskap-lista i den ordning de ligger i PROFFS_STATION
  const proffsEqList = PROFFS_STATION.equipment.map((p) => {
    const type = getEquipmentById(p.typeId);
    return {
      eqId: p.id,
      label: type?.name ?? p.typeId,
    };
  });

  const handlePlayAgain = () => {
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
          width: "100%", maxWidth: 460,
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
          {multiplayerActive && selfTotalRank > 0 && (
            <> · din placering: <strong style={{ color: "#f1f5f9" }}>{rankSuffix(selfTotalRank)}</strong></>
          )}
        </div>

        {inProffs && (
          <div style={{ textAlign: "left", marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: "#64748b",
              textTransform: "uppercase", letterSpacing: "0.12em",
              marginBottom: 6,
            }}>
              Resultat per redskap
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {proffsEqList.map(({ eqId, label }) => {
                const selfScore = equipmentBestClear[eqId] ?? 0;
                const selfFailed = failedEquipment.includes(eqId);

                // Rangordning över alla spelare som har clear-poäng > 0 på detta redskap
                const eqRanking = [...allRows]
                  .map((r) => ({
                    row: r,
                    s: r.perEq[eqId] ?? 0,
                  }))
                  .filter((x) => x.s > 0)
                  .sort((a, b) => b.s - a.s);

                const selfEqRank = eqRanking.findIndex((x) => x.row.isSelf) + 1;
                const leader = eqRanking[0]?.row;

                return (
                  <div
                    key={eqId}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", borderRadius: 8,
                      background: selfFailed && selfScore === 0
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(255,255,255,0.04)",
                      fontSize: 12,
                    }}
                  >
                    <span style={{
                      flex: 1, color: "#e2e8f0", fontWeight: 700,
                    }}>
                      {label}
                    </span>
                    <span style={{
                      color: selfScore > 0 ? "#cbd5e1" : "#64748b",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 800, minWidth: 56, textAlign: "right",
                    }}>
                      {selfScore > 0
                        ? `${selfScore.toLocaleString("sv-SE")} p`
                        : selfFailed ? "Bommad" : "–"}
                    </span>
                    {multiplayerActive && eqRanking.length > 0 && (
                      <span style={{
                        minWidth: 90, textAlign: "right",
                        fontSize: 10, fontWeight: 700,
                      }}>
                        {selfEqRank > 0 ? (
                          <span style={{
                            color: selfEqRank === 1 ? "#f59e0b" : "#94a3b8",
                          }}>
                            {rankSuffix(selfEqRank)} av {eqRanking.length}
                          </span>
                        ) : leader ? (
                          <span style={{ color: "#64748b" }}>
                            Bäst: {leader.name.length > 8
                              ? leader.name.slice(0, 8) + "…"
                              : leader.name}
                          </span>
                        ) : null}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* Summa-rad */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", borderRadius: 8,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                fontSize: 12, marginTop: 4,
              }}>
                <span style={{ flex: 1, color: "#f1f5f9", fontWeight: 800 }}>
                  Totalt
                </span>
                <span style={{
                  color: "#f1f5f9",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 900, minWidth: 56, textAlign: "right",
                }}>
                  {score.toLocaleString("sv-SE")} p
                </span>
                {multiplayerActive && selfTotalRank > 0 && (
                  <span style={{
                    minWidth: 90, textAlign: "right",
                    fontSize: 10, fontWeight: 800,
                    color: selfTotalRank === 1 ? "#f59e0b" : "#cbd5e1",
                  }}>
                    {rankSuffix(selfTotalRank)} av {totalRanking.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {multiplayerActive && (
          <div style={{ textAlign: "left", marginBottom: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: "#64748b",
              textTransform: "uppercase", letterSpacing: "0.12em",
              marginBottom: 6,
            }}>
              Totalplacering (rum {roomCode})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {totalRanking.slice(0, 8).map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px", borderRadius: 6,
                    background: r.isSelf
                      ? "rgba(59,130,246,0.18)"
                      : "rgba(255,255,255,0.03)",
                    border: r.isSelf
                      ? "1px solid rgba(59,130,246,0.4)"
                      : "1px solid transparent",
                    fontSize: 12,
                  }}
                >
                  <span style={{
                    width: 18, textAlign: "center",
                    color: i === 0 ? "#f59e0b" : i === 1 ? "#cbd5e1" : i === 2 ? "#d97706" : "#94a3b8",
                    fontWeight: 800,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: r.color, flexShrink: 0,
                  }} />
                  <span style={{
                    flex: 1, color: "#f1f5f9", fontWeight: r.isSelf ? 800 : 600,
                  }}>
                    {r.name}
                  </span>
                  <span style={{
                    color: "#cbd5e1",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                  }}>
                    {r.total.toLocaleString("sv-SE")}
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
