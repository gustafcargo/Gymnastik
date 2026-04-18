/**
 * multiplayer.ts – tunn wrapper runt Supabase Realtime.
 *
 * Använder enbart anonyma Broadcast + Presence-kanaler: ingen databas,
 * inga RLS-regler, ingen auth. Ett rum = en kanalnamn-sträng.
 *
 * Om VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY saknas exporterar modulen
 * en `isMultiplayerEnabled === false`-flagga så UI kan dölja multiplayer-
 * knappar utan att kasta fel.
 */
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { Plan } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isMultiplayerEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let _client: SupabaseClient | null = null;

function client(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return _client;
}

export type PlayerState = {
  id: string;
  name: string;
  color: string;
  pos: { x: number; y: number; z: number };
  rotY: number;
  pose: Record<string, number>;
  mountedEqId: string | null;
  t: number; // wall-clock (ms)
};

export type PlanPayload = {
  from: string;   // avsändar-id
  plan: Plan;
  t: number;
};

export type PlanRequestPayload = {
  from: string;   // be:are
  t: number;
};

export type RoomHandlers = {
  onStateBroadcast: (state: PlayerState) => void;
  onPresenceSync: (activeIds: string[]) => void;
  onPlanReceived: (payload: PlanPayload) => void;
  onPlanRequest: (payload: PlanRequestPayload) => void;
};

/** Skapa och subscribe:a en kanal för rummet. Caller måste anropa `leaveRoom`. */
export async function joinRoom(
  code: string,
  selfId: string,
  handlers: RoomHandlers,
): Promise<RealtimeChannel | null> {
  const c = client();
  if (!c) return null;
  const channel = c.channel(`gymnastik:room:${code}`, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: selfId },
    },
  });
  channel.on("broadcast", { event: "state" }, ({ payload }) => {
    handlers.onStateBroadcast(payload as PlayerState);
  });
  channel.on("broadcast", { event: "plan" }, ({ payload }) => {
    handlers.onPlanReceived(payload as PlanPayload);
  });
  channel.on("broadcast", { event: "plan-request" }, ({ payload }) => {
    handlers.onPlanRequest(payload as PlanRequestPayload);
  });
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<{ id: string }>();
    handlers.onPresenceSync(Object.keys(state));
  });
  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ id: selfId });
      // Be alla andra i rummet om deras aktuella plan. Befintliga spelare
      // svarar med "plan"-broadcast; joinaren adopterar första mottagna.
      void channel.send({
        type: "broadcast",
        event: "plan-request",
        payload: { from: selfId, t: Date.now() } satisfies PlanRequestPayload,
      });
    }
  });
  return channel;
}

/** Broadcast:a en lokal spelar-state. Antal/sekund throttlas på callersidan. */
export function sendState(channel: RealtimeChannel | null, state: PlayerState): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "state", payload: state });
}

/** Skicka aktuell plan som svar på en plan-request. */
export function sendPlan(channel: RealtimeChannel | null, payload: PlanPayload): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "plan", payload });
}

export async function leaveRoom(channel: RealtimeChannel | null): Promise<void> {
  if (!channel) return;
  try {
    await channel.unsubscribe();
  } catch {
    // ignoreras – kanalen kan redan vara stängd
  }
}

/** 6-teckens alfanumerisk rumskod (A-Z, 0-9). */
export function makeRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // utan liknande tecken (I, 1, O, 0)
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
