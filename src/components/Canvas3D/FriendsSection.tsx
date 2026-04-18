/**
 * FriendsSection – vän-hantering inuti RoomPanel.
 *
 * Varje användare har en lokal 4-siffrig vän-kod som syns tydligt i
 * panelens fot. Koden delas muntligt / via chat med vännen som skriver
 * in den i sin egen "Lägg till vän"-ruta. När vännen senare är online i
 * lobbyn matchas buddyCode mot `lobbyUsers` i `useMultiplayerStore` → UI:t
 * visar "online"-prick + "Bjud in"-knapp (bara synlig när vi själva sitter
 * i ett rum).
 */
import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, Send, Trash2, UserPlus } from "lucide-react";
import { useFriendsStore } from "../../store/useFriendsStore";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";

type Props = {
  onToast: (msg: string) => void;
};

export function FriendsSection({ onToast }: Props) {
  const myBuddyCode = useFriendsStore((s) => s.buddyCode);
  const friends = useFriendsStore((s) => s.friends);
  const visibleInLobby = useFriendsStore((s) => s.visibleInLobby);
  const addFriend = useFriendsStore((s) => s.addFriend);
  const removeFriend = useFriendsStore((s) => s.removeFriend);
  const toggleVisibility = useFriendsStore((s) => s.toggleVisibility);

  const lobbyUsers = useMultiplayerStore((s) => s.lobbyUsers);
  const roomCode = useMultiplayerStore((s) => s.roomCode);
  const sendInviteTo = useMultiplayerStore((s) => s.sendInviteTo);

  const [addCode, setAddCode] = useState("");

  // Matcha varje vän (via buddyCode) mot aktiva lobby-användare. Ger
  // { friend, online: bool, lobbyUser?: LobbyUser }.
  const friendStatus = useMemo(() => {
    const byCode: Record<string, typeof lobbyUsers[string]> = {};
    for (const u of Object.values(lobbyUsers)) {
      byCode[u.buddyCode] = u;
    }
    return friends.map((f) => ({
      friend: f,
      lobbyUser: byCode[f.buddyCode],
      online: Boolean(byCode[f.buddyCode]),
    }));
  }, [friends, lobbyUsers]);

  const onlineCount = friendStatus.filter((s) => s.online).length;

  const handleAdd = () => {
    const ok = addFriend(addCode);
    if (ok) {
      onToast("Vän tillagd!");
      setAddCode("");
    } else {
      onToast("Ogiltig / redan tillagd");
    }
  };

  const handleInvite = (friendPlayerId: string, friendName: string) => {
    if (!roomCode) {
      onToast("Skapa ett rum först");
      return;
    }
    sendInviteTo(friendPlayerId);
    onToast(`Inbjudan till ${friendName} skickad`);
  };

  const handleCopyOwn = async () => {
    try {
      await navigator.clipboard.writeText(myBuddyCode);
      onToast("Din kod kopierad!");
    } catch {
      onToast(`Din kod: ${myBuddyCode}`);
    }
  };

  const headerLabel: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    fontSize: 10, color: "#94a3b8", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em",
    marginTop: 8, marginBottom: 6,
    paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)",
  };
  const subtleBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    color: "#f1f5f9", fontSize: 11, fontWeight: 600, padding: "4px 8px",
    cursor: "pointer",
  };
  const primaryBtn: React.CSSProperties = {
    ...subtleBtn,
    background: "rgba(59,130,246,0.85)",
    border: "1px solid rgba(59,130,246,0.5)",
    color: "#fff",
  };
  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6, color: "#f1f5f9", fontSize: 12,
    padding: "5px 8px", outline: "none",
    letterSpacing: "0.15em", textAlign: "center",
  };

  return (
    <div>
      <div style={headerLabel}>
        <span>Vänner{onlineCount > 0 ? ` · ${onlineCount} online` : ""}</span>
        <button
          type="button"
          onClick={toggleVisibility}
          title={visibleInLobby ? "Synlig för vänner" : "Osynlig"}
          style={{
            display: "grid", placeItems: "center",
            width: 22, height: 22, borderRadius: 11,
            background: visibleInLobby ? "rgba(34,197,94,0.25)" : "rgba(100,116,139,0.25)",
            border: "none",
            color: visibleInLobby ? "#86efac" : "#94a3b8",
            cursor: "pointer", padding: 0,
          }}
        >
          {visibleInLobby ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
      </div>

      {friends.length === 0 && (
        <div style={{ fontSize: 10, color: "#64748b", padding: "2px 0 6px" }}>
          Inga vänner tillagda än. Byt vän-koder och lägg till nedan.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {friendStatus.map(({ friend, lobbyUser, online }) => {
          const label = lobbyUser?.name ?? friend.savedName ?? `Vän ${friend.buddyCode}`;
          const canInvite = online && Boolean(roomCode) && lobbyUser != null;
          return (
            <div
              key={friend.buddyCode}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 6px",
                background: online ? "rgba(34,197,94,0.08)" : "transparent",
                borderRadius: 6,
                border: "1px solid " + (online ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"),
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: online ? "#22c55e" : "#475569",
                flexShrink: 0,
              }} />
              <span style={{
                flex: 1, fontSize: 11, fontWeight: online ? 600 : 400,
                color: online ? "#f1f5f9" : "#94a3b8",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {label}
                {lobbyUser?.inRoom && lobbyUser.roomCode && (
                  <span style={{ fontSize: 9, color: "#64748b", marginLeft: 4 }}>
                    · i rum {lobbyUser.roomCode}
                  </span>
                )}
              </span>
              {canInvite && lobbyUser && (
                <button
                  type="button"
                  onClick={() => handleInvite(lobbyUser.playerId, label)}
                  style={{ ...primaryBtn, padding: "3px 6px", fontSize: 10 }}
                  title="Bjud in till ditt rum"
                >
                  <Send size={10} /> Bjud in
                </button>
              )}
              <button
                type="button"
                onClick={() => removeFriend(friend.buddyCode)}
                aria-label="Ta bort"
                style={{
                  display: "grid", placeItems: "center",
                  width: 22, height: 22, borderRadius: 11,
                  background: "transparent", border: "none",
                  color: "#64748b", cursor: "pointer", padding: 0,
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Lägg till vän */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Vän-kod"
          value={addCode}
          onChange={(e) => setAddCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          maxLength={4}
        />
        <button
          type="button"
          onClick={handleAdd}
          style={subtleBtn}
          disabled={addCode.length !== 4}
        >
          <UserPlus size={11} /> Lägg till
        </button>
      </div>

      {/* Egen kod */}
      <button
        type="button"
        onClick={() => void handleCopyOwn()}
        title="Din vän-kod — dela med kompisar"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", marginTop: 8,
          background: "rgba(168,85,247,0.1)",
          border: "1px dashed rgba(168,85,247,0.5)",
          borderRadius: 6, padding: "6px 10px",
          color: "#f1f5f9", cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 600 }}>
          Din kod
        </span>
        <span style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 18, fontWeight: 800, letterSpacing: "0.25em",
        }}>
          {myBuddyCode}
        </span>
        <Check size={12} color="#c4b5fd" />
      </button>
    </div>
  );
}
