/**
 * InboxBanner – visas överst i AccountPanel när usern har en eller flera
 * obesvarade inbjudningar adresserade till sin e-post. Accept-knapp ropar
 * `accept_invite`-RPC och lägger till hen i klubb/lag-medlemskapet.
 */
import { useState } from "react";
import { Check, Mailbox, X } from "lucide-react";
import { useIncomingInvites } from "../../lib/useInvites";

export function InboxBanner() {
  const { invites, acceptInvite } = useIncomingInvites();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = invites.filter((i) => !dismissed.includes(i.id));
  if (visible.length === 0) return null;

  const onAccept = async (id: string, token: string) => {
    setBusyId(id);
    setErr(null);
    try {
      await acceptInvite(token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-200">
        <Mailbox size={13} />
        Du har {visible.length} inbjudning{visible.length === 1 ? "" : "ar"}
      </div>
      {err && <div className="mb-1 text-xs text-rose-300">{err}</div>}
      <ul className="flex flex-col gap-1.5">
        {visible.map((inv) => (
          <li key={inv.id} className="flex items-center gap-2 text-xs text-amber-50">
            <span className="flex-1 truncate">
              {inv.club_id ? "Klubb" : "Lag"}
              {" · "}
              <span className="text-amber-100/80">
                {inv.role === "admin" ? "Administratör"
                  : inv.role === "coach" ? "Tränare"
                  : "Medlem"}
              </span>
            </span>
            <button
              type="button"
              disabled={busyId === inv.id}
              onClick={() => void onAccept(inv.id, inv.token)}
              className="flex items-center gap-1 rounded bg-emerald-500/80 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <Check size={11} /> Acceptera
            </button>
            <button
              type="button"
              onClick={() => setDismissed((d) => [...d, inv.id])}
              className="grid h-6 w-6 place-items-center rounded text-amber-100/70 hover:bg-amber-500/20"
              title="Dölj"
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
