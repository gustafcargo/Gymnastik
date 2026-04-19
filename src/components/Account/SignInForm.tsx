import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "../../lib/useAuth";

export function SignInForm() {
  const { signInWithEmail, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-50/10 p-4 text-sm text-amber-200">
        Supabase är inte konfigurerat. Sätt <code>VITE_SUPABASE_URL</code> och
        {" "}<code>VITE_SUPABASE_ANON_KEY</code> i <code>.env.local</code>.
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg(null);
    try {
      await signInWithEmail(email.trim());
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-emerald-400/40 bg-emerald-50/10 p-4 text-sm text-emerald-200">
        Magisk länk skickad till <strong>{email}</strong>. Öppna mejlet på
        samma enhet för att logga in. (Länken fungerar i ~1 timme.)
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          E-post
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
        disabled={status === "sending"}
        className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-60"
      >
        <Mail size={14} />
        {status === "sending" ? "Skickar…" : "Skicka magisk länk"}
      </button>
      {status === "error" && errorMsg && (
        <div className="text-xs text-rose-400">{errorMsg}</div>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Du får en engångslänk i mejlen — inget lösenord behövs. Din profil, dina
        vänner, klubbar och pass synkas till alla dina enheter.
      </p>
    </form>
  );
}
