import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useAccountStore } from "../../store/useAccountStore";
import { useAuth } from "../../lib/useAuth";
import { useClubs } from "../../lib/useClubs";
import { useTeams, useTeamMembers } from "../../lib/useTeams";
import { InvitesSection } from "./InvitesSection";

export function TeamsTab() {
  const activeClubId = useAccountStore((s) => s.activeClubId);
  const { clubs } = useClubs();
  const activeClub = clubs.find((c) => c.id === activeClubId) ?? null;
  const isClubAdmin = activeClub?.role === "admin";
  const { teams, fetching, error, createTeam } = useTeams(activeClubId);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  if (!activeClubId) {
    return (
      <div className="text-sm text-slate-400">
        Välj en förening under fliken <strong>Föreningar</strong> först.
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
      await createTeam(trimmed);
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
          Lag i föreningen
        </div>
        {fetching && teams.length === 0 ? (
          <div className="text-sm text-slate-500">Laddar…</div>
        ) : teams.length === 0 ? (
          <div className="text-sm text-slate-500">
            Inga lag än — skapa ett nedan.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {teams.map((team) => {
              const active = selectedTeamId === team.id;
              return (
                <li key={team.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(active ? null : team.id)}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      active
                        ? "border-blue-400 bg-blue-500/15 text-slate-100"
                        : "border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <Users size={14} className="text-slate-400" />
                    <span className="flex-1 font-semibold">{team.name}</span>
                  </button>
                  {active && (
                    <>
                      <TeamMembersList teamId={team.id} />
                      <InvitesSectionForTeam teamId={team.id} isClubAdmin={Boolean(isClubAdmin)} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-800/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Nytt lag
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Lagets namn (t.ex. F10)"
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
      </form>
    </div>
  );
}

function InvitesSectionForTeam({
  teamId,
  isClubAdmin,
}: {
  teamId: string;
  isClubAdmin: boolean;
}) {
  const { user } = useAuth();
  const { members } = useTeamMembers(teamId);
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = isClubAdmin || myRole === "coach" || myRole === "admin";
  if (!canManage) return null;
  return (
    <div className="ml-5">
      <InvitesSection kind="team" teamId={teamId} canManage />
    </div>
  );
}

function TeamMembersList({ teamId }: { teamId: string }) {
  const { members, fetching } = useTeamMembers(teamId);
  return (
    <div className="mt-1.5 ml-5 border-l border-slate-700 pl-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Medlemmar
      </div>
      {fetching && members.length === 0 ? (
        <div className="text-xs text-slate-500">Laddar…</div>
      ) : members.length === 0 ? (
        <div className="text-xs text-slate-500">Inga medlemmar än.</div>
      ) : (
        <ul className="flex flex-col gap-0.5 text-xs text-slate-300">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between">
              <span>{m.display_name}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {m.role === "admin" ? "Admin"
                  : m.role === "coach" ? "Tränare"
                  : "Medlem"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
