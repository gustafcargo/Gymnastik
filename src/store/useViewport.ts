/**
 * useViewport – persisterar canvas-vyns pan/zoom (2D) och kamera-orbit
 * (3D) över unmounts. Utan detta tappas vyn varje gång HallStage/Hall3D
 * monteras om, t.ex. vid 2D↔3D-växel, breakpoint-byte, spelläge-toggle
 * eller när profilpanelen ändrar layouten runtomkring. Staten lever
 * bara under session (ingen persist) — användaren förväntar sig inte
 * att zoomen sparas över reload.
 */
import { create } from "zustand";

type ViewportState = {
  // 2D: pan i container-px från hall-center, scale relativt fit-scale=1.
  pan: { x: number; y: number };
  scale: number;
  setPan: (p: { x: number; y: number }) => void;
  setScale: (s: number) => void;
  set2D: (p: { x: number; y: number }, s: number) => void;
  reset2D: () => void;

  // 3D: kamerans orbit runt hallens mitt.
  orbit: { yaw: number; pitch: number; distScale: number };
  setOrbit: (o: { yaw: number; pitch: number; distScale: number }) => void;
  reset3D: () => void;

  // 3D-editor-kamera: exakt position + target vid senaste
  // användarinteraktionen. Persistas separat från orbit eftersom
  // orbit är spelägets touch-gest-offset. null = använd default
  // från Hall3D vid mount.
  editorCam: {
    position: [number, number, number];
    target: [number, number, number];
  } | null;
  setEditorCam: (cam: {
    position: [number, number, number];
    target: [number, number, number];
  }) => void;
};

export const useViewport = create<ViewportState>((set) => ({
  pan: { x: 0, y: 0 },
  scale: 1,
  setPan: (pan) => set({ pan }),
  setScale: (scale) => set({ scale }),
  set2D: (pan, scale) => set({ pan, scale }),
  reset2D: () => set({ pan: { x: 0, y: 0 }, scale: 1 }),

  orbit: { yaw: 0, pitch: 0, distScale: 1 },
  setOrbit: (orbit) => set({ orbit }),
  reset3D: () => set({ orbit: { yaw: 0, pitch: 0, distScale: 1 } }),

  editorCam: null,
  setEditorCam: (editorCam) => set({ editorCam }),
}));
