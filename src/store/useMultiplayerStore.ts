/**
 * useMultiplayerStore – rum + fjärrspelare för spelläget.
 *
 * Delar tre ansvar:
 *  1. Lokal spelar-identitet (UUID + namn + färg) som persisteras i
 *     localStorage så man är "samma" mellan sessioner.
 *  2. Aktiv Supabase-kanal + rumskod.
 *  3. Cache av senaste broadcast per fjärrspelare (id → RemotePlayer),
 *     samt vilket redskap var och en monterat (för låsning).
 *
 * Storen är medvetet "dumb": logiken för throttlad broadcast och mount-
 * prevention ligger i GameGymnast3D; storen är bara state + actions.
 *
 * Plan-synk: när en ny spelare joinar skickas "plan-request" automatiskt
 * från multiplayer.ts. Alla befintliga klienter får requesten och skickar
 * sin aktuella plan. Joinaren adopterar första mottagna planen (sedan
 * nonchaleras dubletter).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  joinRoom,
  leaveRoom,
  sendPlan,
  joinLobby,
  leaveLobby,
  broadcastIdentity,
  requestIdentities,
  sendInvite as sendInviteBroadcast,
  sendInviteResponse,
  type PlayerState,
  type PlanPayload,
  type PlanRequestPayload,
  type LobbyIdentity,
  type InvitePayload,
  type InviteResponsePayload,
} from "../lib/multiplayer";
import { usePlanStore } from "./usePlanStore";
import { useFriendsStore } from "./useFriendsStore";

export type RemotePlayer = {
  id: string;
  name: string;
  color: string;
  pos: { x: number; y: number; z: number };
  rotY: number;
  pose: Record<string, number>;
  mountedEqId: string | null;
  lastSeenT: number; // wall-clock ms (Date.now())
  // Tävlings-state (optional — sätts bara när motspelaren kör proffs-läget).
  score?: number;
  combo?: number;
  roundEndsAt?: number | null;
  roundActive?: boolean;
};

/** En annan spelare som syns i lobbyn (ej nödvändigtvis i samma rum). */
export type LobbyUser = {
  playerId: string;
  buddyCode: string;
  name: string;
  color: string;
  inRoom: boolean;
  roomCode: string | null;
  lastSeenT: number;
};

/** En inkommande inbjudan som UI:t visar i en accept/neka-modal. */
export type PendingInvite = {
  fromId: string;
  fromName: string;
  fromColor: string;
  fromBuddyCode: string;
  roomCode: string;
  receivedAtMs: number;
};

const LOBBY_IDENTITY_REFRESH_MS = 20_000;  // re-broadcasta var 20:e sek
const LOBBY_USER_TIMEOUT_MS = 45_000;      // nerstädning efter 45 s tystnad
const INVITE_TIMEOUT_MS = 30_000;          // auto-dismiss efter 30 s

type LocalIdentity = {
  playerId: string;
  playerName: string;
  playerColor: string;
};

type RuntimeState = {
  roomCode: string | null;
  channel: RealtimeChannel | null;
  players: Record<string, RemotePlayer>;
  activePresenceIds: string[]; // från presence sync, städar bort timeouts
  hasAdoptedPlan: boolean;     // true när vi fått plan från annan spelare
  joinedAtMs: number;          // när vi subscribea:de senast (ms)

  /** Lobby-kanalens RealtimeChannel (delad global kanal). */
  lobbyChannel: RealtimeChannel | null;
  /** Alla vi har sett identitet för på lobbyn (keyed by playerId). */
  lobbyUsers: Record<string, LobbyUser>;
  /** En inkommande inbjudan som väntar på svar, eller null. */
  pendingInvite: PendingInvite | null;
  /** Interval-id för periodisk identity-broadcast. */
  lobbyHeartbeatId: number | null;
};

type Actions = {
  setPlayerName: (name: string) => void;
  setPlayerColor: (color: string) => void;
  join: (code: string) => Promise<void>;
  leave: () => Promise<void>;
  /** Kallas när en broadcast från en fjärrspelare kommer in. */
  ingestRemote: (payload: PlayerState) => void;
  /** Synka lista av aktiva id:n från presence, ta bort eventuella döda slots. */
  syncPresence: (activeIds: string[]) => void;
  /** Garbage-collect spelare som inte broadcastat på > timeoutMs. */
  reapStale: (timeoutMs?: number) => void;

  // ── Lobby / vänner ─────────────────────────────────────────────────────
  /** Anslut till globala lobby-kanalen. Idempotent. */
  connectLobby: () => Promise<void>;
  /** Koppla bort från lobby:n. */
  disconnectLobby: () => Promise<void>;
  /** Re-broadcasta egen identitet (t.ex. efter room-join/leave). */
  republishIdentity: () => void;
  /** Skicka inbjudan till en specifik vän via lobby. */
  sendInviteTo: (toId: string) => void;
  /** Acceptera väntande inbjudan: joinar rummet och rensar modalen. */
  acceptInvite: () => Promise<void>;
  /** Neka / avvisa väntande inbjudan. */
  dismissInvite: (reason?: "declined" | "timeout") => void;
  /** GC för lobby-users som inte hörts av på länge. */
  reapStaleLobbyUsers: (timeoutMs?: number) => void;
};

type Store = LocalIdentity & RuntimeState & Actions;

const genId = (): string =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const DEFAULT_NAMES = ["Alva", "Beata", "Cornelia", "Disa", "Edit", "Freja", "Greta", "Hanna", "Ida", "Julia"];

export const useMultiplayerStore = create<Store>()(
  persist(
    (set, get) => ({
      playerId: genId(),
      playerName: DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)],
      playerColor: "#c026d3",

      roomCode: null,
      channel: null,
      players: {},
      activePresenceIds: [],
      hasAdoptedPlan: false,
      joinedAtMs: 0,

      lobbyChannel: null,
      lobbyUsers: {},
      pendingInvite: null,
      lobbyHeartbeatId: null,

      setPlayerName: (name) => set({ playerName: name.slice(0, 20) || "Gymnast" }),
      setPlayerColor: (color) => set({ playerColor: color }),

      join: async (code) => {
        const { channel: existing, playerId, roomCode: currentRoom } = get();
        const normalized = code.toUpperCase().slice(0, 6);
        // Om vi redan är i samma rum med en aktiv kanal: gör inget. Skyddar
        // mot React strict-mode double-invokes och mot att autojoin fyras
        // av flera gånger.
        if (existing && currentRoom === normalized) return;
        if (existing) await leaveRoom(existing);
        set({
          roomCode: normalized,
          channel: null,
          players: {},
          activePresenceIds: [],
          hasAdoptedPlan: false,
          joinedAtMs: Date.now(),
        });
        const newChannel = await joinRoom(normalized, playerId, {
          onStateBroadcast: (payload) => get().ingestRemote(payload),
          onPresenceSync: (ids) => get().syncPresence(ids),
          onPlanReceived: (payload: PlanPayload) => {
            // Bara första mottagna planen adopteras, för att undvika
            // att flera host-svar skriver över varandra.
            if (get().hasAdoptedPlan) return;
            if (payload.from === get().playerId) return;
            // Skydd mot tyst överskrivning: om den lokala spelaren redan
            // har redskap utplacerade behåller vi deras plan. Utan denna
            // vakt förlorar en spelare som byggt sin hall och sen öppnar
            // en delad länk hela sin plan i tysthet.
            const localPlan = usePlanStore.getState().plan;
            const hasLocalContent = localPlan.stations.some(
              (s) => s.equipment.length > 0,
            );
            if (hasLocalContent) {
              set({ hasAdoptedPlan: true });
              return;
            }
            usePlanStore.getState().adoptRemotePlan(payload.plan);
            set({ hasAdoptedPlan: true });
          },
          onPlanRequest: (payload: PlanRequestPayload) => {
            // Svara bara om requesten kommer från någon annan, och bara
            // om vi själva är "etablerade" (joinade för > 1s sedan) – annars
            // blir det en join-race där två joiners frågar varandra samtidigt.
            if (payload.from === get().playerId) return;
            const { channel, joinedAtMs } = get();
            if (!channel) return;
            if (Date.now() - joinedAtMs < 1000) return;
            const plan = usePlanStore.getState().plan;
            sendPlan(channel, {
              from: get().playerId,
              plan,
              t: Date.now(),
            });
          },
        });
        set({ channel: newChannel });
        // Berätta för lobbyn att vi nu är i ett rum.
        get().republishIdentity();
      },

      leave: async () => {
        const { channel } = get();
        if (channel) await leaveRoom(channel);
        set({
          roomCode: null,
          channel: null,
          players: {},
          activePresenceIds: [],
          hasAdoptedPlan: false,
          joinedAtMs: 0,
        });
        // Berätta för lobbyn att vi inte längre är i rum.
        get().republishIdentity();
      },

      ingestRemote: (payload) => {
        if (payload.id === get().playerId) return; // ignorera ekon
        set((s) => ({
          players: {
            ...s.players,
            [payload.id]: {
              id: payload.id,
              name: payload.name,
              color: payload.color,
              pos: payload.pos,
              rotY: payload.rotY,
              pose: payload.pose,
              mountedEqId: payload.mountedEqId,
              lastSeenT: Date.now(),
              score: payload.score,
              combo: payload.combo,
              roundEndsAt: payload.roundEndsAt ?? null,
              roundActive: payload.roundActive ?? false,
            },
          },
        }));
      },

      syncPresence: (ids) => {
        const selfId = get().playerId;
        const others = ids.filter((id) => id !== selfId);
        set((s) => {
          // Ta bort spelare som inte längre finns i presence
          const keep: Record<string, RemotePlayer> = {};
          for (const id of others) {
            if (s.players[id]) keep[id] = s.players[id];
          }
          return { activePresenceIds: others, players: keep };
        });
      },

      reapStale: (timeoutMs = 8000) => {
        const now = Date.now();
        set((s) => {
          const kept: Record<string, RemotePlayer> = {};
          let changed = false;
          for (const [id, p] of Object.entries(s.players)) {
            if (now - p.lastSeenT < timeoutMs) kept[id] = p;
            else changed = true;
          }
          return changed ? { players: kept } : s;
        });
      },

      // ── Lobby-logik ──────────────────────────────────────────────────────
      connectLobby: async () => {
        const { lobbyChannel: existing, playerId } = get();
        if (existing) return;
        const channel = await joinLobby(playerId, {
          onIdentity: (identity: LobbyIdentity) => {
            if (identity.playerId === get().playerId) return;
            set((s) => ({
              lobbyUsers: {
                ...s.lobbyUsers,
                [identity.playerId]: {
                  playerId: identity.playerId,
                  buddyCode: identity.buddyCode,
                  name: identity.name,
                  color: identity.color,
                  inRoom: identity.inRoom,
                  roomCode: identity.roomCode,
                  lastSeenT: Date.now(),
                },
              },
            }));
          },
          onPresenceSync: (ids) => {
            const selfId = get().playerId;
            const activeSet = new Set(ids);
            // Ta bort användare från lobbyUsers som inte längre finns i presence
            set((s) => {
              const kept: Record<string, LobbyUser> = {};
              for (const [id, u] of Object.entries(s.lobbyUsers)) {
                if (id !== selfId && activeSet.has(id)) kept[id] = u;
              }
              return { lobbyUsers: kept };
            });
          },
          onInvite: (payload: InvitePayload) => {
            const selfId = get().playerId;
            if (payload.toId !== selfId) return; // ej till oss
            // En inbjudan åt gången — ignorera dubbletter
            if (get().pendingInvite) return;
            const receivedAt = Date.now();
            set({
              pendingInvite: {
                fromId: payload.fromId,
                fromName: payload.fromName,
                fromColor: payload.fromColor,
                fromBuddyCode: payload.fromBuddyCode,
                roomCode: payload.roomCode,
                receivedAtMs: receivedAt,
              },
            });
            // Auto-dismiss efter timeout om användaren inte svarar. Matcha på
            // receivedAtMs så vi inte råkar dismiss:a en NY inbjudan från samma
            // avsändare som landat under tiden.
            window.setTimeout(() => {
              const inv = get().pendingInvite;
              if (inv && inv.fromId === payload.fromId && inv.receivedAtMs === receivedAt) {
                get().dismissInvite("timeout");
              }
            }, INVITE_TIMEOUT_MS);
          },
          onInviteResponse: (payload: InviteResponsePayload) => {
            const selfId = get().playerId;
            if (payload.toId !== selfId) return;
            // UI-notis kunde visas här; just nu räcker det att vänten
            // som skickade inbjudan ser om den som fick den dyker upp i rummet
            // eller inte. Lämna som no-op tills vi behöver "X nekade"-toast.
            void payload;
          },
          onIdentityRequest: (fromId) => {
            void fromId;
            // Någon ny bad alla om identitet — svara direkt.
            get().republishIdentity();
          },
        });
        if (!channel) return;
        set({ lobbyChannel: channel });

        // Första identity + request så vi snabbt får en uppdaterad lista
        get().republishIdentity();
        requestIdentities(channel, playerId);

        // Heartbeat: re-broadcasta var 20:e sek
        const heartbeat = window.setInterval(() => {
          get().republishIdentity();
          get().reapStaleLobbyUsers();
        }, LOBBY_IDENTITY_REFRESH_MS);
        set({ lobbyHeartbeatId: heartbeat });
      },

      disconnectLobby: async () => {
        const { lobbyChannel, lobbyHeartbeatId } = get();
        if (lobbyHeartbeatId != null) window.clearInterval(lobbyHeartbeatId);
        if (lobbyChannel) await leaveLobby(lobbyChannel);
        set({
          lobbyChannel: null,
          lobbyUsers: {},
          pendingInvite: null,
          lobbyHeartbeatId: null,
        });
      },

      republishIdentity: () => {
        const { lobbyChannel, playerId, playerName, playerColor, roomCode } = get();
        if (!lobbyChannel) return;
        const friends = useFriendsStore.getState();
        if (!friends.visibleInLobby) return; // respekt användarens osynlighetsval
        const identity: LobbyIdentity = {
          playerId,
          buddyCode: friends.buddyCode,
          name: playerName,
          color: playerColor,
          inRoom: roomCode != null,
          roomCode,
          t: Date.now(),
        };
        broadcastIdentity(lobbyChannel, identity);
      },

      sendInviteTo: (toId: string) => {
        const {
          lobbyChannel, playerId, playerName, playerColor, roomCode,
        } = get();
        if (!lobbyChannel) return;
        if (!roomCode) return; // måste vara i rum för att kunna bjuda in
        const friends = useFriendsStore.getState();
        sendInviteBroadcast(lobbyChannel, {
          fromId: playerId,
          fromName: playerName,
          fromColor: playerColor,
          fromBuddyCode: friends.buddyCode,
          toId,
          roomCode,
          t: Date.now(),
        });
      },

      acceptInvite: async () => {
        const invite = get().pendingInvite;
        if (!invite) return;
        const { lobbyChannel, playerId } = get();
        set({ pendingInvite: null });
        // Notifiera avsändaren att vi accepterade (mest för UX-toast;
        // när vi faktiskt joinar rummet ser de oss som spelare ändå).
        if (lobbyChannel) {
          sendInviteResponse(lobbyChannel, {
            fromId: playerId,
            toId: invite.fromId,
            accepted: true,
            t: Date.now(),
          });
        }
        await get().join(invite.roomCode);
      },

      dismissInvite: (reason = "declined") => {
        const invite = get().pendingInvite;
        if (!invite) return;
        const { lobbyChannel, playerId } = get();
        if (lobbyChannel && reason === "declined") {
          sendInviteResponse(lobbyChannel, {
            fromId: playerId,
            toId: invite.fromId,
            accepted: false,
            t: Date.now(),
          });
        }
        set({ pendingInvite: null });
      },

      reapStaleLobbyUsers: (timeoutMs = LOBBY_USER_TIMEOUT_MS) => {
        const now = Date.now();
        set((s) => {
          const kept: Record<string, LobbyUser> = {};
          let changed = false;
          for (const [id, u] of Object.entries(s.lobbyUsers)) {
            if (now - u.lastSeenT < timeoutMs) kept[id] = u;
            else changed = true;
          }
          return changed ? { lobbyUsers: kept } : s;
        });
      },
    }),
    {
      name: "gymnast-player-v1",
      // Persistera bara identitet – runtime-state (kanal, players) ska inte sparas
      partialize: (s) => ({
        playerId: s.playerId,
        playerName: s.playerName,
        playerColor: s.playerColor,
      }),
    },
  ),
);
