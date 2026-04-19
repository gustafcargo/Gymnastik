import { LogOut, Sliders } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { useFriendsStore } from "../../store/useFriendsStore";
import { useStudioStore } from "../../store/useStudioStore";
import { useAccountStore } from "../../store/useAccountStore";

export function ProfileTab() {
  const { user, signOut } = useAuth();
  const playerName = useMultiplayerStore((s) => s.playerName);
  const setPlayerName = useMultiplayerStore((s) => s.setPlayerName);
  const playerColor = useMultiplayerStore((s) => s.playerColor);
  const setPlayerColor = useMultiplayerStore((s) => s.setPlayerColor);
  const buddyCode = useFriendsStore((s) => s.buddyCode);
  const setAppearanceOpen = useStudioStore((s) => s.setAppearanceOpen);
  const closePanel = useAccountStore((s) => s.closePanel);

  const openGymnastEditor = () => {
    closePanel();
    setAppearanceOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {user && (
        <div className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs">
          <div className="text-slate-400">Inloggad som</div>
          <div className="truncate font-mono text-[13px] text-slate-200">
            {user.email ?? user.id}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Namn
        </span>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Färg
        </span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={playerColor}
            onChange={(e) => setPlayerColor(e.target.value)}
            className="h-9 w-14 rounded-md border border-slate-600 bg-slate-800"
          />
          <code className="text-xs text-slate-400">{playerColor}</code>
        </div>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Vänkod
        </span>
        <div className="flex items-center gap-2">
          <code className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-[15px] text-slate-100">
            {buddyCode}
          </code>
          <span className="text-xs text-slate-500">
            Dela den här med dina vänner så de kan lägga till dig.
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={openGymnastEditor}
        className="flex items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700"
      >
        <Sliders size={14} /> Anpassa gymnast (utseende)
      </button>

      {user && (
        <button
          type="button"
          onClick={signOut}
          className="flex items-center justify-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
        >
          <LogOut size={14} /> Logga ut
        </button>
      )}
    </div>
  );
}
