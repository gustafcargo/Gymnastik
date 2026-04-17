/**
 * PosePreview – liten 3D-scen som renderar en gymnast driven av en given
 * `Pose`. Används i ExerciseStudio för att visa editorns aktuella pose.
 *
 * Till skillnad från `Gymnast3D` använder vi inte `useFrame` för
 * tidslinje-evaluering; posen kommer direkt som prop och refs uppdateras
 * när prop:en ändras.
 */
import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  GymnastBody,
  H_THIGH, H_SHIN,
  type BodyRefs,
} from "../Canvas3D/GymnastBody";
import type { Pose, ExerciseDef } from "../../types/pose";

type Props = {
  pose: Pose;
  def: ExerciseDef;
  color?: string;
};

function RiggedGymnast({ pose, def, color = "#c026d3" }: Props) {
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

  // Bas-Y så fötterna står på golvet (stand-surface default).
  const baseY = H_THIGH + H_SHIN;

  useEffect(() => {
    const p = { ...pose };
    if (def.baseRotY) p.rootRotY += def.baseRotY;

    if (rootRef.current) {
      rootRef.current.position.set(p.rootX, baseY + p.rootY, p.rootZ);
      rootRef.current.rotation.x = p.rootRotX;
      rootRef.current.rotation.y = p.rootRotY;
    }
    const r = bodyRefs;
    if (r.spineRef.current) { r.spineRef.current.rotation.x = p.spineX; r.spineRef.current.rotation.z = p.spineZ; }
    if (r.headRef.current)  { r.headRef.current.rotation.x  = p.headX;  r.headRef.current.rotation.z  = p.headZ; }
    if (r.lShRef.current)   { r.lShRef.current.rotation.x = p.lShX; r.lShRef.current.rotation.z = p.lShZ; }
    if (r.lElRef.current)     r.lElRef.current.rotation.x = p.lElX;
    if (r.rShRef.current)   { r.rShRef.current.rotation.x = p.rShX; r.rShRef.current.rotation.z = p.rShZ; }
    if (r.rElRef.current)     r.rElRef.current.rotation.x = p.rElX;
    if (r.lHipRef.current)    r.lHipRef.current.rotation.x = p.lHipX;
    if (r.lKnRef.current)     r.lKnRef.current.rotation.x  = p.lKnX;
    if (r.rHipRef.current)    r.rHipRef.current.rotation.x = p.rHipX;
    if (r.rKnRef.current)     r.rKnRef.current.rotation.x  = p.rKnX;
  }, [pose, def.baseRotY, baseY, bodyRefs]);

  return (
    <group ref={rootRef} position={[0, baseY, 0]}>
      <GymnastBody color={color} skin="#E8C99A" hair="#2d1a08" refs={bodyRefs} />
    </group>
  );
}

export function PosePreview({ pose, def, color }: Props) {
  return (
    <Canvas
      shadows
      camera={{ position: [1.8, 1.5, 2.4], fov: 40 }}
      style={{ background: "#f1f5f9", width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Environment preset="studio" />
      <Grid
        args={[6, 6]}
        cellSize={0.5}
        cellColor="#cbd5e1"
        sectionSize={2}
        sectionColor="#94a3b8"
        fadeDistance={10}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.25} />
      </mesh>
      <RiggedGymnast pose={pose} def={def} color={color} />
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={6}
        target={[0, 0.9, 0]}
      />
    </Canvas>
  );
}
