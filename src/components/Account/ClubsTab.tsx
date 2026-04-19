import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useClubs } from "../../lib/useClubs";
import { useAccountStore } from "../../store/useAccountStore";
import { InvitesSection } from "./InvitesSection";

export function ClubsTab() {
  const { user } = useAuth();
  const { clubs, fetching, error, createClub } = useClubs();
  const activeClubId = useAccountStore((s) => s.activeClubId);
  const setActiveClubId = useAccountStore((s) => s.setActiveClubId);
  const activeClub = clubs.find((c) => c.id === activeClubId) ?? null;
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="text-sm text-slate-400">
        Logga in för att skapa eller gå med i en förening.
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      const id = await createClub(trimmed);
      setActiveClubId(id);
      setNewName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Mina föreningar
        </div>
        {fetching && clubs.length === 0 ? (
          <div className="text-sm text-slate-500">Laddar…</div>
        ) : clubs.length === 0 ? (
          <div className="text-sm text-slate-500">
            Du är inte med i någon förening än. Skapa en nedan eller be en
            administratör bjuda in dig.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {clubs.map((club) => {
              const active = activeClubId === club.id;
              return (
                <li key={club.id}>
                  <button
                    type="button"
                    onClick={() => setActiveClubId(club.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                      active
                        ? "border-blue-400 bg-blue-500/15 text-slate-100"
                        : "border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{club.name}</div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-500">
                        {club.role === "admin" ? "Administratör"
                          : club.role === "coach" ? "Tränare"
                          : "Medlem"}
                      </div>
                    </div>
                    {active && <Check size={14} className="text-blue-300" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {activeClub && (
        <InvitesSection
          kind="club"
          clubId={activeClub.id}
          canManage={activeClub.role === "admin"}
        />
      )}

      <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-800/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Skapa ny förening
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Föreningens namn"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            <Plus size={14} /> Skapa
          </button>
        </div>
        {createError && (
          <div className="text-xs text-rose-400">{createError}</div>
        )}
        <div className="text-[11px] text-slate-500">
          Du blir automatiskt administratör för föreningen du skapar.
        </div>
      </form>
    </div>
  );
}
