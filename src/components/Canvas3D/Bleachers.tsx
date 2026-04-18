/**
 * Bleachers – läktare + stiliserad publik längs hallens två kortsidor.
 *
 * Renderas bara under spelläget (se Hall3D). Syftar till att ge scenen
 * känsla av "tävling" utan att dra ned fps på iPad.
 *
 * Uppbyggnad:
 *   • Två spegelvända trapp-läktare på ±Z utanför hallens golvyta.
 *   • Publik som två InstancedMesh (kropp + huvud) med ~20 figurer per steg
 *     per sida → ~160 åskådare totalt, 2 draw-calls för publiken.
 *   • Subtil animation via useFrame: varje instans bobbar lite i y och
 *     roterar lite i yaw med eget fas-offset — ingen synkron "bølge".
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  hallW: number;
  hallH: number;
};

type AudienceSeed = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  color: THREE.Color;
  phase: number;
  swayAmp: number;
};

const STEP_COUNT = 4;
const STEP_DEPTH = 0.8;       // m (z-dimension of each bench)
const STEP_RISE = 0.25;       // m (y per step)
const SEAT_OFFSET_FROM_HALL = 0.5; // m gap between hall edge and first step
const PEOPLE_PER_STEP = 20;
const BODY_HEIGHT = 0.38;
const BODY_RADIUS = 0.11;
const HEAD_RADIUS = 0.09;

const PALETTE = [
  "#fda4af", "#fcd34d", "#a7f3d0", "#bae6fd", "#c4b5fd", "#fed7aa",
  "#fca5a5", "#fde68a", "#86efac", "#7dd3fc",
];

// Enkel determistisk PRNG så samma hall återger samma publik mellan renderings.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Bleachers({ hallW, hallH }: Props) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  const seeds = useMemo<AudienceSeed[]>(() => {
    const rnd = mulberry32(Math.round(hallW * 131 + hallH * 17 + 1));
    const out: AudienceSeed[] = [];
    for (const side of [-1, 1]) {
      for (let step = 0; step < STEP_COUNT; step++) {
        const benchZ = side * (hallH / 2 + SEAT_OFFSET_FROM_HALL + step * STEP_DEPTH + STEP_DEPTH / 2);
        const benchY = STEP_RISE + step * STEP_RISE;
        for (let i = 0; i < PEOPLE_PER_STEP; i++) {
          const slotW = hallW / PEOPLE_PER_STEP;
          const jitter = (rnd() - 0.5) * slotW * 0.5;
          const x = (i + 0.5) * slotW + jitter; // 0..hallW (hallens lokala rum)
          // Publik vänder ansiktet mot mitten av hallen. side=-1 står vid
          // negativa Z; de ska titta mot +Z, dvs yaw ≈ 0 (gymnasten använder
          // rotY=0 → ansikte mot −Z, så deras "fram" skall vara mot +Z).
          const baseRotY = side === -1 ? Math.PI : 0;
          const rotY = baseRotY + (rnd() - 0.5) * 0.25;
          const color = new THREE.Color(PALETTE[Math.floor(rnd() * PALETTE.length)]);
          const phase = rnd() * Math.PI * 2;
          const swayAmp = 0.8 + rnd() * 0.6;
          out.push({ x, y: benchY, z: benchZ, rotY, color, phase, swayAmp });
        }
      }
    }
    return out;
  }, [hallW, hallH]);

  // Skriv initial färg per instans.
  useMemo(() => {
    if (!bodyRef.current) return;
    for (let i = 0; i < seeds.length; i++) {
      bodyRef.current.setColorAt(i, seeds[i].color);
    }
    if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
  }, [seeds]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const bob = Math.sin(t * 2 + s.phase) * 0.04;
      const sway = Math.sin(t + s.phase) * 0.05 * s.swayAmp;
      // Kropp
      dummy.position.set(s.x, s.y + BODY_HEIGHT / 2 + bob, s.z);
      dummy.rotation.set(0, s.rotY + sway, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      // Huvud: sitter ovanpå kroppen med sin egen rot (följer med men vickar
      // inte extra — klart enkelt nog att läsa).
      dummy.position.set(s.x, s.y + BODY_HEIGHT + HEAD_RADIUS + bob, s.z);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    // Initiera färg vid första framen om den inte var redo vid mount.
    if (body.instanceColor == null) {
      for (let i = 0; i < seeds.length; i++) body.setColorAt(i, seeds[i].color);
    }
  });

  // Läktar-steg (box-geometrier). En mesh per sida per steg — få draw-calls,
  // accepterar shadow/receiveShadow så scenbelysningen stämmer med golvet.
  const steps: React.ReactNode[] = [];
  for (const side of [-1, 1]) {
    for (let step = 0; step < STEP_COUNT; step++) {
      const z = side * (hallH / 2 + SEAT_OFFSET_FROM_HALL + step * STEP_DEPTH + STEP_DEPTH / 2);
      const y = STEP_RISE / 2 + step * STEP_RISE;
      steps.push(
        <mesh
          key={`step-${side}-${step}`}
          position={[hallW / 2, y, z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[hallW, STEP_RISE, STEP_DEPTH]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} metalness={0} />
        </mesh>,
      );
      // Lätt vertikal front/baksida så stegen inte ser ut att "flyta" —
      // bara ett lågt skuggband under varje steg.
      if (step > 0) {
        const frontZ = side * (hallH / 2 + SEAT_OFFSET_FROM_HALL + step * STEP_DEPTH);
        steps.push(
          <mesh
            key={`riser-${side}-${step}`}
            position={[hallW / 2, (step - 0.5) * STEP_RISE, frontZ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[hallW, STEP_RISE, 0.04]} />
            <meshStandardMaterial color="#475569" roughness={0.9} />
          </mesh>,
        );
      }
    }
  }

  return (
    <group>
      {steps}
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, seeds.length]}
        frustumCulled={false}
        castShadow
      >
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS * 1.15, BODY_HEIGHT, 8]} />
        <meshStandardMaterial roughness={0.75} metalness={0} />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, seeds.length]}
        frustumCulled={false}
        castShadow
      >
        <sphereGeometry args={[HEAD_RADIUS, 10, 8]} />
        <meshStandardMaterial color="#e8b594" roughness={0.7} metalness={0} />
      </instancedMesh>
    </group>
  );
}
