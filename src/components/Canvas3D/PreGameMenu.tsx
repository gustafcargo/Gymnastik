/**
 * PreGameMenu – startmeny som alltid visas när spelläget startar.
 *
 * Låter spelaren:
 *   • välja svårighetsgrad (auto / manuell / proffs)
 *   • välja spelläge (fri / tävling — bara aktivt när proffs är valt)
 *   • se sina personbästa (både fri och tävling)
 *   • se live-leaderboard om multiplayer-rum är aktivt
 *
 * När "Spela!" trycks:
 *   • failedEquipment rensas så alla redskap är tillgängliga igen
 *   • score/combo nollställs (färska siffror till startmenyn)
 *   • menyn stängs och HUD:et visas
 */
import { useEffect, useState } from "react";
import { Gamepad2, Dumbbell, Trophy, Timer, X, Play, UserCircle2, Sparkles } from "lucide-react";
import { useGameConfig, isProffsMode, type Difficulty } from "../../store/useGameConfig";
import { useGameScore } from "../../store/useGameScore";
import { useGameMode, type GameMode } from "../../store/useGameMode";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { useAccountStore } from "../../store/useAccountStore";
import { isMultiplayerEnabled } from "../../lib/multiplayer";
import { FriendsSection } from "./FriendsSection";
import { GymnastStylePanel } from "./GymnastStylePanel";

type Props = {
  onStart: () => void;
  onExit: () => void;
};

export function PreGameMenu({ onStart, onExit }: Props) {
  const difficulty = useGameConfig((s) => s.difficulty);
  const setDifficulty = useGameConfig((s) => s.setDifficulty);
  const gameMode = useGameMode((s) => s.gameMode);
  const setGameMode = useGameMode((s) => s.setGameMode);
  const lifetimeBestTavling = useGameScore((s) => s.lifetimeBestTavling);
  const lifetimeBestFri = useGameScore((s) => s.lifetimeBestFri);
  const players = useMultiplayerStore((s) => s.players);
  const selfName = useMultiplayerStore((s) => s.playerName);
  const selfColor = useMultiplayerStore((s) => s.playerColor);
  const roomCode = useMultiplayerStore((s) => s.roomCode);
  const connectLobby = useMultiplayerStore((s) => s.connectLobby);
  const openAccount = useAccountStore((s) => s.openPanel);

  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Anslut lobby-kanalen så vi kan se vilka vänner som är online redan
  // innan spelet startar. Idempotent — om lobbyn redan är ansluten sker
  // ingenting.
  useEffect(() => {
    if (!isMultiplayerEnabled) return;
    void connectLobby();
  }, [connectLobby]);

  // Auto-dismiss toast efter 2.5 s.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const difficulties: { id: Difficulty; label: string; hint: string; Icon: typeof Gamepad2 }[] = [
    { id: "auto",    label: "Auto",    hint: "Övningen spelas själv",        Icon: Gamepad2 },
    { id: "manuell", label: "Manuell", hint: "Du scrubbar själv med joystick", Icon: Dumbbell },
    { id: "proffs",  label: "Proffs",  hint: "Tajma tricks, samla poäng",    Icon: Trophy },
  ];
  const modes: { id: GameMode; label: string; hint: string }[] = [
    { id: "fri",     label: "Fri",     hint: "Ingen tid — samla poäng i lugn takt" },
    { id: "tavling", label: "Tävling", hint: "60-sekunders rundor + topplista" },
  ];

  const handleStart = () => {
    const score = useGameScore.getState();
    score.resetScore();
    score.clearFailedEquipment();
    onStart();
  };

  const leaderRows = Object.values(players)
    .map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score ?? 0 }))
    .concat([{ id: "self", name: `${selfName} (du)`, color: selfColor, score: 0 }])
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

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
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 18, padding: "22px 22px 18px",
          color: "#f1f5f9",
          boxShadow: "0 20px 70px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
            Starta spelläge
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => openAccount("profile")}
              aria-label="Konto & profil"
              title="Redigera profil, gymnast & klubb"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "5px 9px",
                color: "#cbd5e1", fontSize: 11, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <UserCircle2 size={12} /> Profil
            </button>
            <button
              type="button"
              onClick={onExit}
              aria-label="Avsluta"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "5px 9px",
                color: "#cbd5e1", fontSize: 11, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <X size={12} /> Avsluta
            </button>
          </div>
        </div>

        {/* Svårighetsgrad */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Svårighetsgrad
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {difficulties.map(({ id, label, hint, Icon }) => {
            const active = difficulty === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDifficulty(id)}
                style={{
                  flex: 1,
                  padding: "9px 6px",
                  borderRadius: 10,
                  border: active ? "1px solid rgba(59,130,246,0.65)" : "1px solid rgba(255,255,255,0.12)",
                  background: active ? "rgba(59,130,246,0.22)" : "rgba(255,255,255,0.04)",
                  color: active ? "#f1f5f9" : "#cbd5e1",
                  cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <Icon size={18} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 9, color: "#94a3b8", textAlign: "center", lineHeight: 1.25 }}>{hint}</span>
              </button>
            );
          })}
        </div>

        {/* Spelläge — bara relevant i proffs */}
        <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          Spelläge
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {modes.map(({ id, label, hint }) => {
            const active = gameMode === id;
            const disabled = !isProffsMode(difficulty) && id === "tavling";
            return (
              <button
                key={id}
                type="button"
                onClick={() => { if (!disabled) setGameMode(id); }}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  borderRadius: 10,
                  border: active ? "1px solid rgba(245,158,11,0.65)" : "1px solid rgba(255,255,255,0.12)",
                  background: active
                    ? "rgba(245,158,11,0.2)"
                    : disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                  color: disabled ? "#475569" : active ? "#f1f5f9" : "#cbd5e1",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.6 : 1,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <Timer size={16} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 9, color: "#94a3b8", textAlign: "center", lineHeight: 1.25 }}>{hint}</span>
              </button>
            );
          })}
        </div>

        {/* Personbästa */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, padding: "9px 12px",
          marginBottom: 12,
          display: "flex", justifyContent: "space-between", gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Rekord · Fri
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, color: "#cbd5e1",
              fontVariantNumeric: "tabular-nums",
            }}>
              {lifetimeBestFri.toLocaleString("sv-SE")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Rekord · Tävling
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, color: "#f59e0b",
              fontVariantNumeric: "tabular-nums",
            }}>
              {lifetimeBestTavling.toLocaleString("sv-SE")}
            </div>
          </div>
        </div>

        {/* Utseende-editor (Profil & lag nås via toolbarens avatarknapp) */}
        <button
          type="button"
          onClick={() => setStylePanelOpen(true)}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "rgba(236,72,153,0.15)",
            border: "1px solid rgba(236,72,153,0.4)",
            borderRadius: 10, padding: "10px 12px",
            color: "#fbcfe8", fontSize: 12, fontWeight: 700,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          <Sparkles size={14} /> Utseende
        </button>

        {/* Vänner – online-lista + "Bjud in" när man är i rum */}
        {isMultiplayerEnabled && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "10px 12px",
            marginBottom: 12,
          }}>
            <FriendsSection onToast={setToast} />
          </div>
        )}

        {/* Leaderboard (om multiplayer-rum) */}
        {roomCode && leaderRows.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Topplista (rum {roomCode})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {leaderRows.map((r, i) => (
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

        <button
          type="button"
          onClick={handleStart}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #22c55e, #16a34a)",
            color: "#fff",
            fontSize: 15, fontWeight: 800,
            letterSpacing: "0.04em",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 6px 20px rgba(34,197,94,0.45)",
          }}
        >
          <Play size={16} /> Spela!
        </button>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
            zIndex: 260,
            background: "rgba(15,23,42,0.96)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10, padding: "8px 14px",
            color: "#f1f5f9", fontSize: 12, fontWeight: 600,
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          }}
        >
          {toast}
        </div>
      )}

      <GymnastStylePanel open={stylePanelOpen} onClose={() => setStylePanelOpen(false)} />
    </div>
  );
}
