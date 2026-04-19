/**
 * InvitesSection – admin/coach-vy för att skapa + visa pågående inbjudningar
 * till en klubb eller ett lag. Token visas som kopierbar länk; användaren
 * förväntas själv mejla den (separat MTA-integration är utanför scope).
 */
import { useState } from "react";
import { Check, Copy, Mail, Trash2 } from "lucide-react";
import { useOutgoingInvites, type MemberRole } from "../../lib/useInvites";

type Props =
  | { kind: "club"; clubId: string; canManage: boolean }
  | { kind: "team"; teamId: string; canManage: boolean };

const ROLE_LABEL: Record<MemberRole, string> = {
  admin: "Administratör",
  coach: "Tränare",
  member: "Medlem",
};

export function InvitesSection(props: Props) {
  const scope = props.kind === "club"
    ? ({ kind: "club" as const, clubId: props.clubId })
    : ({ kind: "team" as const, teamId: props.teamId });
  const { invites, fetching, error, createInvite, revokeInvite } = useOutgoingInvites(scope);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!props.canManage) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setErr(null);
    try {
      await createInvite(trimmed, role);
      setEmail("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async (token: string, id: string) => {
    const link = `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore clipboard fel — användare kan markera texten manuellt
    }
  };

  const options: MemberRole[] = props.kind === "club"
    ? ["member", "coach", "admin"]
    : ["member", "coach"];

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-800/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Bjud in via e-post
      </div>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          placeholder="namn@exempel.se"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
        >
          {options.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          <Mail size={14} /> Skicka
        </button>
      </form>
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {error && <div className="text-xs text-rose-400">{error}</div>}

      <div className="text-[11px] text-slate-500">
        Inbjudan gäller i 14 dagar. Kopiera länken och skicka den själv —
        mottagaren loggar in med samma e-post och accepterar automatiskt.
      </div>

      {fetching && invites.length === 0 ? (
        <div className="text-xs text-slate-500">Laddar…</div>
      ) : invites.length === 0 ? (
        <div className="text-xs text-slate-500">Inga pågående inbjudningar.</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {invites.map((inv) => {
            const accepted = Boolean(inv.accepted_at);
            const expired = new Date(inv.expires_at).getTime() < Date.now();
            return (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-300"
              >
                <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {ROLE_LABEL[inv.role]}
                </span>
                <span className="text-[10px] uppercase tracking-wider">
                  {accepted
                    ? <span className="text-emerald-400">Accepterad</span>
                    : expired
                    ? <span className="text-rose-400">Utgången</span>
                    : <span className="text-amber-300">Väntar</span>}
                </span>
                {!accepted && !expired && (
                  <button
                    type="button"
                    onClick={() => copyLink(inv.token, inv.id)}
                    className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    title="Kopiera inbjudningslänk"
                  >
                    {copiedId === inv.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { if (confirm(`Ta bort inbjudan till ${inv.email}?`)) void revokeInvite(inv.id); }}
                  className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                  title="Ta bort inbjudan"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
