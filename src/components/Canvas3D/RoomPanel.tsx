/**
 * RoomPanel – multiplayer-widget i spellägets HUD.
 *
 * Kollapserad: liten rund knapp (Users-ikon) med badge = antal spelare.
 * Expanderad: full panel med invite/join (inte i rum) eller spelarlista
 * + länk/lämna (i rum).
 *
 * Allt körs klient-sidigt; realtidssynken sker via `useMultiplayerStore`
 * mot Supabase Realtime. Om Supabase-env saknas (isMultiplayerEnabled=
 * false) renderas inget alls.
 */
import { useState } from "react";
import { Users, Copy, LogOut, Plus, X } from "lucide-react";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { isMultiplayerEnabled, makeRoomCode } from "../../lib/multiplayer";

export function RoomPanel() {
  const playerId = useMultiplayerStore((s) => s.playerId);
  const playerName = useMultiplayerStore((s) => s.playerName);
  const playerColor = useMultiplayerStore((s) => s.playerColor);
  const roomCode = useMultiplayerStore((s) => s.roomCode);
  const players = useMultiplayerStore((s) => s.players);
  const setName = useMultiplayerStore((s) => s.setPlayerName);
  const join = useMultiplayerStore((s) => s.join);
  const leave = useMultiplayerStore((s) => s.leave);

  const [open, setOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  if (!isMultiplayerEnabled) {
    return null;
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleInvite = async () => {
    const code = makeRoomCode();
    await join(code);
    const url = `${location.origin}${location.pathname}?room=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Länk kopierad!");
    } catch {
      showToast(`Rum: ${code}`);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    await join(code);
    setJoinCode("");
  };

  const totalPlayers = roomCode ? 1 + Object.keys(players).length : 0;

  const iconBtnStyle: React.CSSProperties = {
    position: "absolute", top: 14, left: 14,
    width: 40, height: 40, borderRadius: 20,
    display: "grid", placeItems: "center",
    background: "rgba(10,18,32,0.88)", backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#f1f5f9", cursor: "pointer", pointerEvents: "all",
    boxShadow: "0 6px 20px rgba(0,0,0,0.4)", padding: 0,
  };
  const badgeStyle: React.CSSProperties = {
    position: "absolute", top: -4, right: -4,
    minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9,
    background: "#22c55e", color: "#052e16",
    fontSize: 10, fontWeight: 800, lineHeight: "18px",
    textAlign: "center", border: "1.5px solid rgba(10,18,32,0.88)",
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={iconBtnStyle}
        aria-label={roomCode ? `Multiplayer – ${totalPlayers} spelare` : "Multiplayer"}
      >
        <Users size={18} />
        {roomCode && <span style={badgeStyle}>{totalPlayers}</span>}
      </button>
    );
  }

  const panelStyle: React.CSSProperties = {
    position: "absolute", top: 14, left: 14,
    background: "rgba(10,18,32,0.88)", backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12,
    padding: "10px 12px", pointerEvents: "all",
    minWidth: 200, maxWidth: 260,
    color: "#f1f5f9", fontSize: 12, fontFamily: "system-ui, sans-serif",
    boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
  };
  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(59,130,246,0.85)",
    border: "1px solid rgba(59,130,246,0.5)", borderRadius: 6,
    color: "#fff", fontSize: 11, fontWeight: 600, padding: "5px 10px",
    cursor: "pointer",
  };
  const subtleBtn: React.CSSProperties = {
    ...btn,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  };
  const closeBtn: React.CSSProperties = {
    display: "grid", placeItems: "center",
    width: 22, height: 22, borderRadius: 11,
    background: "rgba(255,255,255,0.08)", border: "none",
    color: "#cbd5e1", cursor: "pointer", padding: 0,
  };
  const headerRow: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 6, marginBottom: 8,
  };
  const headerLabel: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 10, color: "#94a3b8", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em",
  };

  if (roomCode) {
    const list = Object.values(players);
    return (
      <div style={panelStyle}>
        <div style={headerRow}>
          <span style={headerLabel}>
            <Users size={12} /> Rum {roomCode}
          </span>
          <button type="button" style={closeBtn} onClick={() => setOpen(false)} aria-label="Stäng">
            <X size={13} />
          </button>
        </div>

        {/* Spelarlista (inkl. dig själv överst) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          <PlayerRow color={playerColor} name={`${playerName} (du)`} selfId={playerId} isSelf />
          {list.map((p) => (
            <PlayerRow key={p.id} color={p.color} name={p.name} selfId={p.id} />
          ))}
          {list.length === 0 && (
            <div style={{ fontSize: 10, color: "#64748b", padding: "4px 0" }}>
              Väntar på att någon ansluter…
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            style={subtleBtn}
            onClick={async () => {
              const url = `${location.origin}${location.pathname}?room=${roomCode}`;
              try {
                await navigator.clipboard.writeText(url);
                showToast("Länk kopierad!");
              } catch {
                showToast(`Rum: ${roomCode}`);
              }
            }}
          >
            <Copy size={12} /> Länk
          </button>
          <button type="button" style={subtleBtn} onClick={() => void leave()}>
            <LogOut size={12} /> Lämna
          </button>
        </div>

        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={headerRow}>
        <span style={headerLabel}>Multiplayer</span>
        <button type="button" style={closeBtn} onClick={() => setOpen(false)} aria-label="Stäng">
          <X size={13} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        <label style={{ fontSize: 10, color: "#94a3b8" }}>Ditt namn</label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6, color: "#f1f5f9", fontSize: 12,
            padding: "5px 8px", outline: "none",
          }}
        />
      </div>

      <button type="button" style={{ ...btn, width: "100%", justifyContent: "center", marginBottom: 8 }} onClick={() => void handleInvite()}>
        <Plus size={12} /> Bjud in (skapa rum)
      </button>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          placeholder="Kod"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
          style={{
            flex: 1, minWidth: 0,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6, color: "#f1f5f9", fontSize: 12,
            padding: "5px 8px", outline: "none", letterSpacing: "0.1em",
          }}
          onKeyDown={(e) => { if (e.key === "Enter") void handleJoin(); }}
        />
        <button type="button" style={subtleBtn} onClick={() => void handleJoin()}>
          Anslut
        </button>
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

function PlayerRow({ color, name, selfId, isSelf }: { color: string; name: string; selfId: string; isSelf?: boolean }) {
  return (
    <div key={selfId} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "3px 0", fontSize: 11,
      color: isSelf ? "#f1f5f9" : "#cbd5e1",
      fontWeight: isSelf ? 600 : 400,
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        border: "1px solid rgba(255,255,255,0.25)", flexShrink: 0,
      }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      marginTop: 8, padding: "4px 8px",
      background: "rgba(34,197,94,0.25)",
      border: "1px solid rgba(34,197,94,0.5)",
      borderRadius: 6, fontSize: 10, textAlign: "center",
    }}>
      {msg}
    </div>
  );
}
