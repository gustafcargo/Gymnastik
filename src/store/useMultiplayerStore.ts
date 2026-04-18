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
import { joinRoom, leaveRoom, sendPlan, type PlayerState, type PlanPayload, type PlanRequestPayload } from "../lib/multiplayer";
import { usePlanStore } from "./usePlanStore";

export type RemotePlayer = {
  id: string;
  name: string;
  color: string;
  pos: { x: number; y: number; z: number };
  rotY: number;
  pose: Record<string, number>;
  mountedEqId: string | null;
  lastSeenT: number; // wall-clock ms (Date.now())
};

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
