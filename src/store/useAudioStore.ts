/**
 * useAudioStore – mute + master volume för spelljud. Persisteras i
 * localStorage så inställningen överlever reload. Läses av `lib/sfx.ts`
 * innan varje ljud spelas.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

type AudioState = {
  muted: boolean;
  volume: number; // 0..1
  toggle: () => void;
  setMuted: (m: boolean) => void;
  setVolume: (v: number) => void;
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      muted: false,
      volume: 0.6,
      toggle: () => set((s) => ({ muted: !s.muted })),
      setMuted: (muted) => set({ muted }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
    }),
    { name: "gymnast-audio-v1" },
  ),
);
