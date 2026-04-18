/**
 * RemoteGymnast3D – renderar en annan spelares gymnast, driven av senaste
 * broadcast från `useMultiplayerStore`.
 *
 * All rörelse är interpolation: vi behåller föregående och senaste mottagna
 * state och slerpar mellan dem över `INTERP_MS`. Det ger mjuk rörelse även
 * när broadcast kommer fram ojämnt (~15 Hz kan ha jitter).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { GymnastBody, H_THIGH, H_SHIN, type BodyRefs } from "./GymnastBody";
import { ZERO, POSE_KEYS, type Pose } from "../../types/pose";
import type { RemotePlayer } from "../../store/useMultiplayerStore";

const INTERP_MS = 150;

type Snap = {
  t: number;
  pos: { x: number; y: number; z: number };
  rotY: number;
  pose: Pose;
};

function toPose(obj: Record<string, number> | undefined): Pose {
  if (!obj) return ZERO;
  const out = { ...ZERO };
  for (const k of POSE_KEYS) {
    const v = obj[k as string];
    if (typeof v === "number") (out as unknown as Record<string, number>)[k as string] = v;
  }
  return out;
}

/** Kortaste-båge-interpolation mellan två vinklar (radianer). Undviker att
 *  gymnasten spinner 360° när t.ex. rotY går från +π till −π mellan två
 *  broadcasts. */
function lerpAngle(a: number, b: number, alpha: number): number {
  const TWO_PI = Math.PI * 2;
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return a + d * alpha;
}

function lerpSnap(a: Snap, b: Snap, alpha: number): Snap {
  const mix = (x: number, y: number) => x + (y - x) * alpha;
  const pose = { ...ZERO };
  // Alla pose-fält är vinklar (radianer) – interpolera via kortaste båge.
  for (const k of POSE_KEYS) {
    const av = (a.pose as unknown as Record<string, number>)[k as string] ?? 0;
    const bv = (b.pose as unknown as Record<string, number>)[k as string] ?? 0;
    // rootX/rootY/rootZ är förflyttningar i meter, inte vinklar
    const isPos = k === "rootX" || k === "rootY" || k === "rootZ";
    (pose as unknown as Record<string, number>)[k as string] = isPos
      ? mix(av, bv)
      : lerpAngle(av, bv, alpha);
  }
  return {
    t: b.t,
    pos: {
      x: mix(a.pos.x, b.pos.x),
      y: mix(a.pos.y, b.pos.y),
      z: mix(a.pos.z, b.pos.z),
    },
    rotY: lerpAngle(a.rotY, b.rotY, alpha),
    pose,
  };
}

export function RemoteGymnast3D({ player }: { player: RemotePlayer }) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRefs: BodyRefs = {
    spineRef: useRef<THREE.Group>(null),
    headRef:  useRef<THREE.Group>(null),
    lShRef:   useRef<THREE.Group>(null),
    lElRef:   useRef<THREE.Group>(null),
    rShRef:   useRef<THREE.Group>(null),
    rElRef:   useRef<THREE.Group>(null),
    lHipRef:  useRef<THREE.Group>(null),
    lKnRef:   useRef<THREE.Group>(null),
    rHipRef:  useRef<THREE.Group>(null),
    rKnRef:   useRef<THREE.Group>(null),
  };

  // Buffer: senaste två mottagna states. Interpolerar mellan dem.
  const prev = useRef<Snap>({
    t: Date.now() - INTERP_MS,
    pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
    rotY: player.rotY,
    pose: toPose(player.pose),
  });
  const curr = useRef<Snap>({
    t: Date.now(),
    pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
    rotY: player.rotY,
    pose: toPose(player.pose),
  });

  // Uppdatera buffers när nytt broadcast kommer
  const poseMemo = useMemo(() => toPose(player.pose), [player.pose]);
  useEffect(() => {
    prev.current = curr.current;
    curr.current = {
      t: Date.now(),
      pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      rotY: player.rotY,
      pose: poseMemo,
    };
  }, [player.pos.x, player.pos.y, player.pos.z, player.rotY, poseMemo]);

  useFrame(() => {
    const now = Date.now();
    const age = now - curr.current.t;
    const span = Math.max(1, curr.current.t - prev.current.t);
    const alpha = Math.min(1, age / span);
    const s = lerpSnap(prev.current, curr.current, alpha);

    if (rootRef.current) {
      // Matchar lokal rendering i GameGymnast3D: rotation.y = pose.rootRotY
      // (som redan innehåller gymnastens yaw, eqRot och ev. baseRotY).
      // s.rotY skickas fortfarande i payload men används inte här för att
      // undvika dubbelrotation.
      rootRef.current.rotation.order = "YXZ";
      rootRef.current.position.set(s.pos.x, s.pos.y, s.pos.z);
      rootRef.current.rotation.x = s.pose.rootRotX;
      rootRef.current.rotation.y = s.pose.rootRotY;
      rootRef.current.rotation.z = s.pose.rootRotZ;
    }
    const r = bodyRefs;
    const p = s.pose;
    if (r.spineRef.current) { r.spineRef.current.rotation.x = p.spineX; r.spineRef.current.rotation.z = p.spineZ; }
    if (r.headRef.current)  { r.headRef.current.rotation.x  = p.headX;  r.headRef.current.rotation.z  = p.headZ; }
    if (r.lShRef.current)   { r.lShRef.current.rotation.x = p.lShX;  r.lShRef.current.rotation.z = p.lShZ; }
    if (r.lElRef.current)     r.lElRef.current.rotation.x = p.lElX;
    if (r.rShRef.current)   { r.rShRef.current.rotation.x = p.rShX;  r.rShRef.current.rotation.z = p.rShZ; }
    if (r.rElRef.current)     r.rElRef.current.rotation.x = p.rElX;
    if (r.lHipRef.current)  { r.lHipRef.current.rotation.x = p.lHipX; r.lHipRef.current.rotation.z = p.lHipZ; }
    if (r.lKnRef.current)     r.lKnRef.current.rotation.x  = p.lKnX;
    if (r.rHipRef.current)  { r.rHipRef.current.rotation.x = p.rHipX; r.rHipRef.current.rotation.z = p.rHipZ; }
    if (r.rKnRef.current)     r.rKnRef.current.rotation.x  = p.rKnX;

    // Golv-clamp: GameGymnast3D lyfter sin egen rootRef när one-shot-tricks
    // har negativa rootY-värden, men skickar broadcast med pre-clamp-värdet.
    // Utan samma clamp här sjunker fjärrspelaren ner i golvet under t.ex.
    // kullerbytta och framåtrullning.
    if (rootRef.current) {
      rootRef.current.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rootRef.current);
      if (isFinite(box.min.y) && box.min.y < 0) {
        rootRef.current.position.y -= box.min.y;
      }
    }
  });

  // Namnetikett ovanför huvudet
  const nameY = H_THIGH + H_SHIN + 1.1;

  return (
    <group ref={rootRef}>
      <GymnastBody color={player.color} skin="#E8C99A" hair="#2d1a08" refs={bodyRefs} />
      <Html position={[0, nameY, 0]} center distanceFactor={8} zIndexRange={[20, 0]}>
        <div style={{
          background: "rgba(10,18,32,0.85)",
          color: "#fff",
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "system-ui, sans-serif",
          whiteSpace: "nowrap",
          border: `2px solid ${player.color}`,
          pointerEvents: "none",
        }}>
          {player.name}
        </div>
      </Html>
    </group>
  );
}
