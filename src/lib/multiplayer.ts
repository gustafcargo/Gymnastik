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
  // Tävlings-tillstånd (proffs-läget). Optional för bakåtkompat med äldre klienter.
  score?: number;
  combo?: number;
  /** Date.now() då rundan slutar; null/undefined = inte i runda. */
  roundEndsAt?: number | null;
  /** True när spelaren är inne i en aktiv tävlingsrunda (running). */
  roundActive?: boolean;
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

/** Identitet som broadcast:as på lobby-kanalen så vänner kan se varandra. */
export type LobbyIdentity = {
  playerId: string;
  buddyCode: string; // 4-siffrig human-memorable
  name: string;
  color: string;
  inRoom: boolean;
  roomCode: string | null;
  t: number;         // wall-clock ms
};

/** Inbjudan från A till B: "kom och spela i mitt rum". */
export type InvitePayload = {
  fromId: string;
  fromName: string;
  fromColor: string;
  fromBuddyCode: string;
  toId: string;
  roomCode: string;
  t: number;
};

/** Svar på inbjudan. */
export type InviteResponsePayload = {
  fromId: string;   // svarande
  toId: string;     // ursprunglig inbjudare
  accepted: boolean;
  t: number;
};

export type LobbyHandlers = {
  onIdentity: (identity: LobbyIdentity) => void;
  onPresenceSync: (activeIds: string[]) => void;
  onInvite: (payload: InvitePayload) => void;
  onInviteResponse: (payload: InviteResponsePayload) => void;
  /** Någon (ny eller återansluten klient) ber alla re-annonsera sig. */
  onIdentityRequest: (fromId: string) => void;
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

// ── Lobby-kanal ────────────────────────────────────────────────────────────
//
// En enda delad kanal för alla som är i spelläge just nu. Används för
// vän-sökning (buddy-code → playerId) och för att skicka personliga
// inbjudningar mellan vänner. Allt är klient-broadcast; ingen DB.

const LOBBY_CHANNEL = "gymnastik:lobby";

/** Anslut till lobby-kanalen. Kalla `broadcastIdentity` direkt efter för
 *  att annonsera sig själv mot övriga. */
export async function joinLobby(
  selfId: string,
  handlers: LobbyHandlers,
): Promise<RealtimeChannel | null> {
  const c = client();
  if (!c) return null;
  const channel = c.channel(LOBBY_CHANNEL, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: selfId },
    },
  });
  channel.on("broadcast", { event: "identity" }, ({ payload }) => {
    handlers.onIdentity(payload as LobbyIdentity);
  });
  channel.on("broadcast", { event: "invite" }, ({ payload }) => {
    handlers.onInvite(payload as InvitePayload);
  });
  channel.on("broadcast", { event: "invite-response" }, ({ payload }) => {
    handlers.onInviteResponse(payload as InviteResponsePayload);
  });
  channel.on("broadcast", { event: "identity-request" }, ({ payload }) => {
    const p = payload as { from: string };
    if (p.from !== selfId) handlers.onIdentityRequest(p.from);
  });
  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState<{ id: string }>();
    handlers.onPresenceSync(Object.keys(state));
  });
  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ id: selfId });
    }
  });
  return channel;
}

/** Broadcast:a sin identitet på lobby:n. Bör anropas vid join och
 *  periodiskt (var ~20s) så att nyinkommande klienter ser oss. */
export function broadcastIdentity(
  channel: RealtimeChannel | null,
  identity: LobbyIdentity,
): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "identity", payload: identity });
}

/** Be alla i lobbyn att re-broadcasta sin identitet. Används vid eget
 *  join för att snabbt få en lista över online-vänner. */
export function requestIdentities(channel: RealtimeChannel | null, from: string): void {
  if (!channel) return;
  void channel.send({
    type: "broadcast",
    event: "identity-request",
    payload: { from, t: Date.now() },
  });
}

export function sendInvite(channel: RealtimeChannel | null, payload: InvitePayload): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "invite", payload });
}

export function sendInviteResponse(
  channel: RealtimeChannel | null,
  payload: InviteResponsePayload,
): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event: "invite-response", payload });
}

export async function leaveLobby(channel: RealtimeChannel | null): Promise<void> {
  // Samma teknik som leaveRoom; eget namn för tydlighet.
  return leaveRoom(channel);
}

/** 6-teckens alfanumerisk rumskod (A-Z, 0-9). */
export function makeRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // utan liknande tecken (I, 1, O, 0)
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
