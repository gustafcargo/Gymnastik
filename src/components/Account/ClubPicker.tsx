/**
 * ClubPicker – kompakt klubbväljare i toolbaren. Visar aktiv klubb, öppnar
 * en dropdown med alla föreningar user är med i, samt genväg till
 * Föreningar-fliken i AccountPanel när man vill skapa / hantera.
 */
import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useClubs } from "../../lib/useClubs";
import { useAccountStore } from "../../store/useAccountStore";

export function ClubPicker() {
  const { user } = useAuth();
  const { clubs } = useClubs();
  const activeClubId = useAccountStore((s) => s.activeClubId);
  const setActiveClubId = useAccountStore((s) => s.setActiveClubId);
  const openAccount = useAccountStore((s) => s.openPanel);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user || clubs.length === 0) return null;

  const active = clubs.find((c) => c.id === activeClubId) ?? clubs[0];

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 rounded-md bg-surface-2 px-2 text-xs font-semibold text-slate-700 hover:bg-surface-3"
        title={`Aktiv förening: ${active.name}`}
      >
        <Building2 size={13} />
        <span className="max-w-[10rem] truncate">{active.name}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-surface-3 bg-white shadow-lg">
          <ul>
            {clubs.map((c) => {
              const isActive = c.id === active.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { setActiveClubId(c.id); setOpen(false); }}
                    className={
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2 " +
                      (isActive ? "bg-surface-2/60 font-semibold" : "")
                    }
                  >
                    <Building2 size={13} className="text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">
                      {c.role === "admin" ? "Admin"
                        : c.role === "coach" ? "Tränare"
                        : "Medlem"}
                    </span>
                    {isActive && <Check size={13} className="text-emerald-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => { setOpen(false); openAccount("clubs"); }}
            className="flex w-full items-center gap-2 border-t border-surface-3 px-3 py-2 text-sm text-slate-700 hover:bg-surface-2"
          >
            <Plus size={13} /> Hantera föreningar
          </button>
        </div>
      )}
    </div>
  );
}
