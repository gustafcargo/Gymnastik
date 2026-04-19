/**
 * CapabilitiesEditor – admin-vy i ClubsTab där klubb-admin kan justera
 * per-medlems roll och individuella capability-overrides. Roll-default-
 * matrisen är hårdkodad i capabilities.ts; denna UI skriver till
 * member_capabilities.overrides i Supabase.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Shield, Trash2 } from "lucide-react";
import {
  ALL_CAPABILITIES,
  CAPABILITY_LABEL,
  CAPABILITY_DESCRIPTION,
  ROLE_DEFAULTS,
  resolveCapabilities,
  type Capability,
  type MemberRole,
} from "../../lib/capabilities";
import { useClubMembers } from "../../lib/useClubMembers";
import { useAuth } from "../../lib/useAuth";

type Props = {
  clubId: string;
};

export function CapabilitiesEditor({ clubId }: Props) {
  const { user } = useAuth();
  const { members, fetching, error, setRole, setOverrides, removeMember } =
    useClubMembers(clubId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        const rank = { admin: 0, coach: 1, member: 2 } as const;
        return (
          rank[a.role] - rank[b.role] ||
          a.display_name.localeCompare(b.display_name, "sv")
        );
      }),
    [members],
  );

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-800/40 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Shield size={13} /> Behörigheter per medlem
      </div>
      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-300">
          {error}
        </div>
      )}
      {fetching && members.length === 0 ? (
        <div className="text-xs text-slate-500">Laddar…</div>
      ) : members.length === 0 ? (
        <div className="text-xs text-slate-500">Inga medlemmar än.</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {sorted.map((m) => {
            const isSelf = m.user_id === user?.id;
            const expanded = expandedId === m.user_id;
            const effective = resolveCapabilities(m.role, m.overrides);
            return (
              <li
                key={m.user_id}
                className="rounded border border-slate-700 bg-slate-900/60"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expanded ? null : m.user_id)
                  }
                  className="flex w-full items-center gap-2 px-2 py-2 text-left"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="flex-1 truncate text-sm text-slate-100">
                    {m.display_name}
                    {isSelf && <span className="ml-1 text-[10px] text-slate-500">(du)</span>}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">
                    {m.role === "admin" ? "Admin"
                      : m.role === "coach" ? "Tränare"
                      : "Medlem"}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-slate-700 px-2 pb-2 pt-1.5">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span>Roll</span>
                      <select
                        value={m.role}
                        disabled={isSelf}
                        onChange={(e) =>
                          void setRole(m.user_id, e.target.value as MemberRole)
                        }
                        className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="member">Medlem</option>
                        <option value="coach">Tränare</option>
                        <option value="admin">Administratör</option>
                      </select>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `Ta bort ${m.display_name} ur klubben?`,
                              )
                            ) {
                              void removeMember(m.user_id);
                            }
                          }}
                          className="ml-auto flex items-center gap-1 rounded bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/30"
                        >
                          <Trash2 size={11} /> Ta bort
                        </button>
                      )}
                    </div>

                    <div className="grid gap-1">
                      {ALL_CAPABILITIES.map((cap) => {
                        const roleDefault = ROLE_DEFAULTS[m.role][cap];
                        const override = m.overrides[cap];
                        const current = effective[cap];
                        const overridden =
                          typeof override === "boolean" && override !== roleDefault;
                        return (
                          <CapRow
                            key={cap}
                            label={CAPABILITY_LABEL[cap]}
                            description={CAPABILITY_DESCRIPTION[cap]}
                            enabled={current}
                            overridden={overridden}
                            disabled={isSelf}
                            onToggle={() => {
                              const nextVal = !current;
                              const next: Partial<Record<Capability, boolean>> = {
                                ...m.overrides,
                              };
                              if (nextVal === roleDefault) {
                                delete next[cap];
                              } else {
                                next[cap] = nextVal;
                              }
                              void setOverrides(m.user_id, next);
                            }}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-500">
                      Grundvärden styrs av rollen. Ändringar här åsidosätter
                      bara för den här medlemmen.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CapRow({
  label,
  description,
  enabled,
  overridden,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  overridden: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex items-center gap-2 rounded px-2 py-1 text-left text-xs transition ${
        disabled ? "opacity-60" : "hover:bg-slate-800"
      }`}
    >
      <span
        className={`grid h-4 w-7 shrink-0 place-items-start rounded-full p-0.5 transition ${
          enabled ? "bg-emerald-500/80" : "bg-slate-600"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white transition ${
            enabled ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-100">
          {label}
          {overridden && (
            <span className="ml-1 text-[9px] font-normal uppercase tracking-wider text-amber-300">
              åsidosatt
            </span>
          )}
        </span>
        <span className="block text-[10px] text-slate-500">{description}</span>
      </span>
    </button>
  );
}
