import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  Grid,
} from "@react-three/drei";
import { usePlanStore } from "../../store/usePlanStore";
import { EQUIPMENT_BY_ID } from "../../catalog/equipment";
import { Equipment3D } from "./Equipment3D";

type Props = { className?: string };

/**
 * Riktig 3D-vy av hallen byggd med Three.js (react-three-fiber).
 * Använder PBR-material och HDRI-baserad belysning för en pro-känsla
 * – inga målade canvas-skisser.
 */
export function Hall3D({ className }: Props) {
  const plan = usePlanStore((s) => s.plan);
  const station = plan.stations.find((s) => s.id === plan.activeStationId);

  const W = plan.hall.widthM;
  const H = plan.hall.heightM;
  const cx = W / 2;
  const cz = H / 2;
  const camDist = Math.max(W, H) * 0.95;

  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [cx + camDist * 0.55, camDist * 0.55, cz + camDist * 0.85],
          fov: 38,
          near: 0.1,
          far: 500,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#EEF2F6"]} />
        <fog attach="fog" args={["#EEF2F6", camDist * 1.4, camDist * 3]} />

        <Suspense fallback={null}>
          <Environment preset="warehouse" background={false} environmentIntensity={0.55} />
        </Suspense>

        {/* Sol-ljus + skuggor */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[W * 0.4, Math.max(W, H) * 1.2, H * 0.3]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
          shadow-camera-left={-W}
          shadow-camera-right={W * 2}
          shadow-camera-top={H * 2}
          shadow-camera-bottom={-H}
          shadow-camera-near={0.5}
          shadow-camera-far={Math.max(W, H) * 4}
        />
        <hemisphereLight intensity={0.25} groundColor="#8a7a5c" color="#dfe7ef" />

        {/* Hallgolv – trä-look via standard material */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[cx, 0, cz]}
          receiveShadow
        >
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial
            color="#D9B382"
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>

        {/* Subtila linjer på golvet */}
        <Grid
          position={[cx, 0.005, cz]}
          args={[W, H]}
          cellSize={1}
          cellThickness={0.4}
          cellColor="#a98855"
          sectionSize={5}
          sectionThickness={0.9}
          sectionColor="#7a5a2e"
          fadeDistance={Math.max(W, H) * 1.6}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
        />

        {/* Mjuk kontaktskugga under allt */}
        <ContactShadows
          position={[cx, 0.01, cz]}
          opacity={0.45}
          scale={Math.max(W, H) * 1.4}
          blur={2.6}
          far={4}
        />

        {/* Redskap */}
        {station?.equipment.map((eq) => {
          const type = EQUIPMENT_BY_ID[eq.typeId];
          if (!type) return null;
          return (
            <group
              key={eq.id}
              position={[eq.x, 0, eq.y]}
              rotation={[0, -(eq.rotation * Math.PI) / 180, 0]}
              scale={[eq.scaleX, 1, eq.scaleY]}
            >
              <Equipment3D type={type} color={eq.customColor} />
            </group>
          );
        })}

        <OrbitControls
          target={[cx, 0, cz]}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={Math.max(W, H) * 3}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>
    </div>
  );
}
