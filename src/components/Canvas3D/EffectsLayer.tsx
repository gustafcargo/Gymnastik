/**
 * EffectsLayer – en enkel partikelpool för spellägets VFX.
 *
 * Användaren-sidan får en ref (`EffectsHandle`) med en enda `spawn`-metod.
 * Interna partiklar lagras i ett fast buffer och uppdateras per frame via
 * `useFrame`. Döda slots återanvänds så vi aldrig allokerar runtime.
 *
 * Tre varianter:
 *   "dust"    – brun/grå puff vid landning/fot-i-golv.
 *   "sparkle" – kort pigg gul/rosa vid trick-start.
 *   "ring"    – horisontell ring av små partiklar (mount).
 *
 * Prestanda: max MAX_PARTICLES aktiva samtidigt. Geometrin är en enda
 * `THREE.Points` med buffer-attribut så hela poolen renderas i ett draw-call.
 */
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_PARTICLES = 200;
const GRAVITY = -4.0; // m/s² (mildare än jordgravitation för mer "fluff")

export type EffectKind = "dust" | "sparkle" | "ring";

export type EffectsHandle = {
  spawn: (opts: {
    kind: EffectKind;
    pos: { x: number; y: number; z: number };
    count?: number;
  }) => void;
};

type Particle = {
  alive: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number;     // sekunder
  life: number;    // max-ålder
  size: number;    // startstorlek
  r: number; g: number; b: number;
};

export const EffectsLayer = forwardRef<EffectsHandle>((_props, ref) => {
  const points = useRef<THREE.Points>(null);
  const pool = useMemo<Particle[]>(
    () =>
      Array.from({ length: MAX_PARTICLES }, () => ({
        alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        age: 0, life: 0, size: 0, r: 1, g: 1, b: 1,
      })),
    [],
  );

  const positions = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const colors    = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const sizes     = useMemo(() => new Float32Array(MAX_PARTICLES), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color",    new THREE.BufferAttribute(colors,    3));
    g.setAttribute("size",     new THREE.BufferAttribute(sizes,     1));
    return g;
  }, [positions, colors, sizes]);

  const material = useMemo(() => new THREE.PointsMaterial({
    size: 0.08,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }), []);

  useImperativeHandle(ref, () => ({
    spawn: ({ kind, pos, count }) => {
      const n = count ?? (kind === "ring" ? 18 : 14);
      for (let i = 0; i < n; i++) {
        const slot = pool.find((p) => !p.alive);
        if (!slot) break;
        slot.alive = true;
        slot.x = pos.x; slot.y = pos.y; slot.z = pos.z;
        slot.age = 0;
        if (kind === "dust") {
          const a = Math.random() * Math.PI * 2;
          const sp = 0.6 + Math.random() * 0.8;
          slot.vx = Math.cos(a) * sp;
          slot.vy = 0.2 + Math.random() * 0.6;
          slot.vz = Math.sin(a) * sp;
          slot.life = 0.5 + Math.random() * 0.3;
          slot.size = 0.10 + Math.random() * 0.05;
          const shade = 0.55 + Math.random() * 0.25;
          slot.r = shade; slot.g = shade * 0.9; slot.b = shade * 0.75;
        } else if (kind === "sparkle") {
          const a = Math.random() * Math.PI * 2;
          const el = Math.random() * Math.PI * 0.5; // uppåt-halvklot
          const sp = 1.5 + Math.random() * 1.5;
          slot.vx = Math.cos(a) * Math.cos(el) * sp;
          slot.vy = Math.sin(el) * sp * 1.2;
          slot.vz = Math.sin(a) * Math.cos(el) * sp;
          slot.life = 0.6 + Math.random() * 0.4;
          slot.size = 0.06 + Math.random() * 0.04;
          // Gul/rosa glittrande
          const pink = Math.random() < 0.5;
          slot.r = 1.0;
          slot.g = pink ? 0.55 : 0.90;
          slot.b = pink ? 0.75 : 0.35;
        } else {
          // ring – jämnt utspridd i XZ-cirkel, liten uppåtkomponent
          const a = (i / n) * Math.PI * 2;
          const sp = 1.0 + Math.random() * 0.4;
          slot.vx = Math.cos(a) * sp;
          slot.vy = 0.4 + Math.random() * 0.3;
          slot.vz = Math.sin(a) * sp;
          slot.life = 0.5 + Math.random() * 0.2;
          slot.size = 0.08;
          slot.r = 0.60; slot.g = 0.80; slot.b = 1.00;
        }
      }
    },
  }), [pool]);

  useFrame((_s, delta) => {
    const dt = Math.min(delta, 1 / 30);
    let anyChange = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p.alive) {
        positions[i * 3 + 0] = 0;
        positions[i * 3 + 1] = -999; // göm
        positions[i * 3 + 2] = 0;
        sizes[i] = 0;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.alive = false;
        positions[i * 3 + 1] = -999;
        sizes[i] = 0;
        anyChange = true;
        continue;
      }
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = 1.0 - p.age / p.life;
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = Math.max(0.01, p.y);
      positions[i * 3 + 2] = p.z;
      colors[i * 3 + 0] = p.r * fade;
      colors[i * 3 + 1] = p.g * fade;
      colors[i * 3 + 2] = p.b * fade;
      sizes[i] = p.size * fade;
      anyChange = true;
    }
    if (anyChange && points.current) {
      const pos = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const col = points.current.geometry.getAttribute("color")    as THREE.BufferAttribute;
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
});

EffectsLayer.displayName = "EffectsLayer";
