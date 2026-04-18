/**
 * InviteModal – overlay som visas när en vän bjudit in oss till sitt rum.
 * Högprioritet: renderas ovanpå hela HUD:et. Lyssnar på
 * `useMultiplayerStore.pendingInvite` och rensar den via accept/dismiss.
 */
import { useMultiplayerStore } from "../../store/useMultiplayerStore";

export function InviteModal() {
  const invite = useMultiplayerStore((s) => s.pendingInvite);
  const accept = useMultiplayerStore((s) => s.acceptInvite);
  const dismiss = useMultiplayerStore((s) => s.dismissInvite);

  if (!invite) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.45)",
      display: "grid", placeItems: "center",
      fontFamily: "system-ui, sans-serif",
      pointerEvents: "all",
    }}>
      <div style={{
        background: "rgba(15,23,42,0.98)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 14,
        padding: "18px 22px",
        color: "#f1f5f9",
        minWidth: 260, maxWidth: 340,
        boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block",
          width: 14, height: 14, borderRadius: "50%",
          background: invite.fromColor,
          border: "2px solid rgba(255,255,255,0.3)",
          marginBottom: 10,
        }} />
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {invite.fromName} bjuder in dig
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
          Rum: <span style={{
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: "#cbd5e1",
          }}>{invite.roomCode}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => dismiss("declined")}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8, padding: "9px 14px",
              color: "#cbd5e1", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Neka
          </button>
          <button
            type="button"
            onClick={() => void accept()}
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              border: "none",
              borderRadius: 8, padding: "9px 14px",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(34,197,94,0.35)",
            }}
          >
            Acceptera
          </button>
        </div>
      </div>
    </div>
  );
}
