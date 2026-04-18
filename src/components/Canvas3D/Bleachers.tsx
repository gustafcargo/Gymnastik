/**
 * Bleachers – enkla läktare + stiliserad publik på hallens kortsidor.
 *
 * Två trappsteg-mesh:ar per sida (±Z) gjorda av box-geometrier. Publik
 * renderas som två InstancedMeshes (huvuden + kroppar) för minimal GPU-
 * kostnad; varje åskådare har en fas-offset som driver subtil bobb/vaja
 * i `useFrame` via setMatrixAt.
 *
 * Visas bara i spelläget – designläget behöver oblockerad vy.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = { hallW: number; hallH: number };

const STEP_COUNT = 4;
const STEP_DEPTH = 0.8;
const STEP_HEIGHT = 0.25;
const STEP_CLEARANCE = 0.5; // avstånd från hall till första steget
const AUDIENCE_PER_STEP_PER_SIDE = 20;

// Pastell-palette (tröjor)
const SHIRT_COLORS = [
  "#fda4af", "#fcd34d", "#a7f3d0",
  "#bae6fd", "#c4b5fd", "#fed7aa",
];
// Hudtoner
const SKIN_COLORS = ["#f5d0c5", "#e8b594", "#c78d68", "#8d5524"];

type Spectator = {
  baseX: number;
  baseY: number;
  baseZ: number;
  baseRotY: number;
  phase: number;
  shirt: THREE.Color;
  skin: THREE.Color;
};

export function Bleachers({ hallW, hallH }: Props) {
  const headRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Bygg publikens basdata deterministiskt per hallstorlek. Regenereras
  // endast när hallen ändrar dimensioner.
  const spectators = useMemo<Spectator[]>(() => {
    const out: Spectator[] = [];
    const cx = hallW / 2;
    // För varje sida (+Z och -Z), för varje trappsteg, ~20 åskådare.
    const sides: Array<1 | -1> = [1, -1];
    // Deterministisk pseudo-random via seed så färger inte hoppar mellan frames
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (const sign of sides) {
      for (let s = 0; s < STEP_COUNT; s++) {
        const zEdge = sign * (hallH / 2 + STEP_CLEARANCE + s * STEP_DEPTH);
        // Sitter mitt på steget (0.4 m in från dess framkant)
        const z = zEdge + sign * STEP_DEPTH * 0.5;
        const y = STEP_HEIGHT * (s + 1);
        for (let i = 0; i < AUDIENCE_PER_STEP_PER_SIDE; i++) {
          // Jämnt fördelade längs X med liten slump
          const frac = (i + 0.5) / AUDIENCE_PER_STEP_PER_SIDE;
          const x = cx - hallW / 2 + frac * hallW + (rand() - 0.5) * 0.15;
          out.push({
            baseX: x,
            baseY: y,
            baseZ: z,
            // Vänd mot banan (Y-rotation): -Z-sidan tittar mot +Z (rotY=PI), +Z-sidan mot -Z (rotY=0)
            baseRotY: sign === 1 ? Math.PI : 0,
            phase: rand() * Math.PI * 2,
            shirt: new THREE.Color(SHIRT_COLORS[Math.floor(rand() * SHIRT_COLORS.length)]),
            skin: new THREE.Color(SKIN_COLORS[Math.floor(rand() * SKIN_COLORS.length)]),
          });
        }
      }
    }
    return out;
  }, [hallW, hallH]);

  // Sätt initial-matriser + färger
  useEffect(() => {
    const head = headRef.current;
    const body = bodyRef.current;
    if (!head || !body) return;
    for (let i = 0; i < spectators.length; i++) {
      const sp = spectators[i];
      // Kropp: cylinder 0.18 bred × 0.45 hög, centrerad i midjehöjd
      dummy.position.set(sp.baseX, sp.baseY + 0.25, sp.baseZ);
      dummy.rotation.set(0, sp.baseRotY, 0);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      body.setColorAt(i, sp.shirt);
      // Huvud: sfär 0.13 i radie, ovanför kroppen
      dummy.position.set(sp.baseX, sp.baseY + 0.58, sp.baseZ);
      dummy.rotation.set(0, sp.baseRotY, 0);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
      head.setColorAt(i, sp.skin);
    }
    head.instanceMatrix.needsUpdate = true;
    body.instanceMatrix.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
  }, [spectators, dummy]);

  // Animera: subtil bobb/vaja per åskådare
  useFrame(({ clock }) => {
    const head = headRef.current;
    const body = bodyRef.current;
    if (!head || !body) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < spectators.length; i++) {
      const sp = spectators[i];
      const bobY = Math.sin(t * 2 + sp.phase) * 0.04;
      const swayY = Math.sin(t + sp.phase) * 0.05;
      // Kropp
      dummy.position.set(sp.baseX, sp.baseY + 0.25 + bobY, sp.baseZ);
      dummy.rotation.set(0, sp.baseRotY + swayY, 0);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      // Huvud
      dummy.position.set(sp.baseX, sp.baseY + 0.58 + bobY, sp.baseZ);
      dummy.rotation.set(0, sp.baseRotY + swayY, 0);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    }
    head.instanceMatrix.needsUpdate = true;
    body.instanceMatrix.needsUpdate = true;
  });

  // Läktarsteg som mesh:ar (två per sida = 8 totalt – billigt)
  const steps: Array<{ x: number; y: number; z: number; w: number; d: number }> = [];
  for (const sign of [1, -1] as const) {
    for (let s = 0; s < STEP_COUNT; s++) {
      const zEdge = sign * (hallH / 2 + STEP_CLEARANCE + s * STEP_DEPTH);
      const z = zEdge + (sign * STEP_DEPTH) / 2;
      steps.push({
        x: hallW / 2,
        y: STEP_HEIGHT / 2 + s * STEP_HEIGHT,
        z,
        w: hallW,
        d: STEP_DEPTH,
      });
    }
  }

  return (
    <group>
      {steps.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.y, s.z]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[s.w, STEP_HEIGHT, s.d]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} metalness={0.0} />
        </mesh>
      ))}

      {/* Publik-huvuden (hudton via instanceColor) */}
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, spectators.length]}
        frustumCulled={false}
        castShadow
      >
        <sphereGeometry args={[0.13, 10, 8]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>

      {/* Publik-kroppar (tröjfärg via instanceColor) */}
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, spectators.length]}
        frustumCulled={false}
        castShadow
      >
        <cylinderGeometry args={[0.18, 0.18, 0.5, 10]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
    </group>
  );
}
