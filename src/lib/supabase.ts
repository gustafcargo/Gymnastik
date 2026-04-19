import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-klienter kastar `PostgrestError` / `AuthError` som vanliga
 * objekt, inte `Error`-instanser. Det gör att vanliga UI-try/catch
 * skriver ut "[object Object]" istället för något meningsfullt. Den här
 * hjälparen packar in valfri fel-form i en riktig Error med rimlig
 * meddelandetext, samtidigt som det fullständiga objektet loggas så vi
 * ser code/details/hint i devtools.
 */
export function sbError(
  err: unknown,
  fallback = "Något gick fel.",
  tag?: string,
): Error {
  if (tag) console.error(`[${tag}]`, err);
  else console.error(err);
  if (err instanceof Error) return err;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const msg = e.message || e.details || e.hint || (e.code ? `Fel (${e.code})` : "");
    if (msg) return new Error(msg);
  }
  if (typeof err === "string" && err) return new Error(err);
  return new Error(fallback);
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return _client;
}
