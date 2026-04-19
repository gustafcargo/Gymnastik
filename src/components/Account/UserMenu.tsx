/**
 * UserMenu – avatar-dropdown som ersätter den gamla "Konto"-knappen i
 * toolbaren. När inte inloggad → öppnar AccountPanel på Profil-fliken
 * (så man ser magic-link-formuläret). När inloggad → dropdown med
 * Profil, Byt konto, Logga ut.
 */
import { useEffect, useRef, useState } from "react";
import { LogOut, RefreshCcw, User, UserCircle2 } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { useAccountStore } from "../../store/useAccountStore";

function initialsFor(name?: string | null, email?: string | null): string {
  const base = (name ?? email ?? "?").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { user, signOut } = useAuth();
  const openAccount = useAccountStore((s) => s.openPanel);
  const playerName = useMultiplayerStore((s) => s.playerName);
  const playerColor = useMultiplayerStore((s) => s.playerColor);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAccount("profile")}
        className="flex h-9 items-center gap-1 rounded-md bg-surface-2 px-2 text-xs font-semibold text-slate-700 transition hover:bg-surface-3"
        title="Logga in"
      >
        <UserCircle2 size={14} />
        <span className="hidden sm:inline">Logga in</span>
      </button>
    );
  }

  const initials = initialsFor(playerName, user.email);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.email ?? playerName}
        className="flex h-9 items-center gap-1.5 rounded-md bg-surface-2 pl-1 pr-2 text-xs font-semibold text-slate-700 transition hover:bg-surface-3"
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white shadow-sm"
          style={{ background: playerColor }}
        >
          {initials}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">
          {playerName}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-surface-3 bg-white shadow-lg">
          <div className="border-b border-surface-3 px-3 py-2">
            <div className="truncate text-sm font-semibold text-slate-800">
              {playerName}
            </div>
            <div className="truncate text-[11px] text-slate-500">
              {user.email}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); openAccount("profile"); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-surface-2"
          >
            <User size={14} /> Profil, klubbar & hallar
          </button>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
              openAccount("profile");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-surface-2"
            title="Logga ut och visa kontoväljaren"
          >
            <RefreshCcw size={14} /> Byt konto
          </button>
          <button
            type="button"
            onClick={async () => { setOpen(false); await signOut(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={14} /> Logga ut
          </button>
        </div>
      )}
    </div>
  );
}
