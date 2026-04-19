import { useState } from "react";
import { Mail, UserRound, X } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useRecentAccounts } from "../../store/useRecentAccounts";

export function SignInForm() {
  const { signInWithEmail, isSupabaseConfigured } = useAuth();
  const accounts = useRecentAccounts((s) => s.accounts);
  const forget = useRecentAccounts((s) => s.forget);

  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-50/10 p-4 text-sm text-amber-200">
        Supabase är inte konfigurerat. Sätt <code>VITE_SUPABASE_URL</code> och
        {" "}<code>VITE_SUPABASE_ANON_KEY</code> i <code>.env.local</code>.
      </div>
    );
  }

  const send = async (addr: string) => {
    setStatus("sending");
    setErrorMsg(null);
    try {
      await signInWithEmail(addr);
      setSentTo(addr);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-emerald-400/40 bg-emerald-50/10 p-4 text-sm text-emerald-200">
          Magisk länk skickad till <strong>{sentTo}</strong>. Öppna mejlet på
          samma enhet för att logga in. (Länken fungerar i ~1 timme.)
        </div>
        <button
          type="button"
          onClick={() => { setSentTo(null); setEmail(""); }}
          className="self-start text-xs text-slate-400 hover:text-slate-200"
        >
          ← Skicka till annan adress
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    await send(trimmed);
  };

  return (
    <div className="flex flex-col gap-3">
      {accounts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Senast använda konton
          </div>
          <ul className="flex flex-col gap-1">
            {accounts.map((a) => (
              <li
                key={a.email}
                className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1.5"
              >
                <UserRound size={14} className="text-slate-400" />
                <button
                  type="button"
                  onClick={() => void send(a.email)}
                  disabled={status === "sending"}
                  className="min-w-0 flex-1 truncate text-left text-sm text-slate-100 hover:text-white disabled:opacity-60"
                >
                  Fortsätt som <span className="font-semibold">{a.email}</span>
                </button>
                <button
                  type="button"
                  onClick={() => forget(a.email)}
                  aria-label={`Glöm ${a.email}`}
                  className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-700 hover:text-slate-200"
                  title="Ta bort från listan"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
          <div className="text-[11px] text-slate-500">
            Ett klick skickar en ny magisk länk till adressen.
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {accounts.length > 0 ? "Eller ny adress" : "E-post"}
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="namn@exempel.se"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
          />
        </label>
        <button
          type="submit"
          disabled={status === "sending" || !email.trim()}
          className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-60"
        >
          <Mail size={14} />
          {status === "sending" ? "Skickar…" : "Skicka magisk länk"}
        </button>
        {status === "error" && errorMsg && (
          <div className="text-xs text-rose-400">{errorMsg}</div>
        )}
      </form>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Du får en engångslänk i mejlen — inget lösenord behövs. Din profil,
        dina vänner, klubbar och pass synkas till alla dina enheter.
      </p>
    </div>
  );
}
