/**
 * PosePreview – liten 3D-scen som renderar en gymnast driven av en given
 * `Pose`. Används i ExerciseStudio för att visa editorns aktuella pose.
 *
 * Till skillnad från `Gymnast3D` använder vi inte `useFrame` för
 * tidslinje-evaluering; posen kommer direkt som prop och refs uppdateras
 * när prop:en ändras.
 *
 * Renderar även ett representativt redskap (valfritt) så man kan kalibrera
 * pose-keyframen mot stång/bom/ringar under editing. baseY justeras till
 * samma formel som runtime-Gymnast3D använder.
 */
import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  GymnastBody,
  H_THIGH, H_SHIN, H_TORSO, H_UPPER, H_LOWER, HANG_DIST,
  type BodyRefs,
} from "../Canvas3D/GymnastBody";
import { Equipment3D } from "../Canvas3D/Equipment3D";
import type { Pose, ExerciseDef } from "../../types/pose";
import type { EquipmentType } from "../../types";
import { EQUIPMENT_CATALOG } from "../../catalog/equipment";

type Props = {
  pose: Pose;
  def: ExerciseDef;
  apparatus?: string;
  color?: string;
};

type Mount = "hang-bar" | "support-bar" | "stand-surface";

// Map apparatus-taggen (från Exercise.apparatus) till en representativ
// EquipmentType ur katalogen + hur gymnasten ska placeras relativt den.
function equipmentForApparatus(app?: string): { type: EquipmentType; mount: Mount } | null {
  if (!app) return null;
  const byKind = (kind: string) => EQUIPMENT_CATALOG.find((e) => e.detail?.kind === kind);
  switch (app) {
    case "high-bar":      return { type: byKind("high-bar")!,      mount: "hang-bar" };
    case "uneven-bars":   return { type: byKind("uneven-bars")!,   mount: "hang-bar" };
    case "rings":         return { type: byKind("rings")!,         mount: "hang-bar" };
    case "rings-free":    return { type: byKind("rings-free")!,    mount: "hang-bar" };
    case "parallel-bars": return { type: byKind("parallel-bars")!, mount: "support-bar" };
    case "pommel-horse":  return { type: byKind("pommel-horse")!,  mount: "support-bar" };
    case "beam":          return { type: byKind("beam")!,          mount: "stand-surface" };
    case "vault":         return { type: byKind("vault")!,         mount: "stand-surface" };
    case "trampette":     return { type: byKind("trampette")!,     mount: "stand-surface" };
    case "mini-tramp":    return { type: byKind("mini-tramp")!,    mount: "stand-surface" };
    case "plinth":        return { type: byKind("plint")!,         mount: "stand-surface" };
    case "buck":          return { type: byKind("bock")!,          mount: "stand-surface" };
    default: return null;
  }
}

// Samma formel som runtime-Gymnast3D – se baseY-beräkningen där.
function baseYFor(app: string | undefined, pH: number, kind: string | undefined): number {
  const m = app ? equipmentForApparatus(app)?.mount : undefined;
  if (m === "hang-bar") {
    if (kind === "rings" || kind === "rings-free") return pH - 0.18 - HANG_DIST;
    return pH + 0.04 - HANG_DIST;
  }
  if (m === "support-bar") return pH + H_UPPER + H_LOWER - H_TORSO * 0.85;
  return H_THIGH + H_SHIN;
}

function RiggedGymnast({ pose, def, apparatus, color = "#c026d3" }: Props) {
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

  const eq = equipmentForApparatus(apparatus);
  const baseY = baseYFor(apparatus, eq?.type.physicalHeightM ?? 0, eq?.type.detail?.kind);
  // Golv-clamp aktivt för fristående golv-övningar (inget redskap eller
  // "floor"). På hängande/stödjande redskap skulle en automatisk lyft ge
  // fel utseende (t.ex. under giant-swing hamnar kroppen tillfälligt långt
  // ned nära stången – inte meningen att lyfta hela kroppen).
  const floorClamp = !apparatus || apparatus === "floor";

  useEffect(() => {
    const p = { ...pose };
    if (def.baseRotY) p.rootRotY += def.baseRotY;

    if (rootRef.current) {
      rootRef.current.position.set(p.rootX, baseY + p.rootY, p.rootZ);
      rootRef.current.rotation.x = p.rootRotX;
      rootRef.current.rotation.y = p.rootRotY;
      rootRef.current.rotation.z = p.rootRotZ;
    }
    const r = bodyRefs;
    if (r.spineRef.current) { r.spineRef.current.rotation.x = p.spineX; r.spineRef.current.rotation.z = p.spineZ; }
    if (r.headRef.current)  { r.headRef.current.rotation.x  = p.headX;  r.headRef.current.rotation.z  = p.headZ; }
    if (r.lShRef.current)   { r.lShRef.current.rotation.x = p.lShX; r.lShRef.current.rotation.z = p.lShZ; }
    if (r.lElRef.current)     r.lElRef.current.rotation.x = p.lElX;
    if (r.rShRef.current)   { r.rShRef.current.rotation.x = p.rShX; r.rShRef.current.rotation.z = p.rShZ; }
    if (r.rElRef.current)     r.rElRef.current.rotation.x = p.rElX;
    if (r.lHipRef.current)  { r.lHipRef.current.rotation.x = p.lHipX; r.lHipRef.current.rotation.z = p.lHipZ; }
    if (r.lKnRef.current)     r.lKnRef.current.rotation.x  = p.lKnX;
    if (r.rHipRef.current)  { r.rHipRef.current.rotation.x = p.rHipX; r.rHipRef.current.rotation.z = p.rHipZ; }
    if (r.rKnRef.current)     r.rKnRef.current.rotation.x  = p.rKnX;

    // ── Golv-clamp: lyft root så inget mesh-hörn hamnar under y = 0 ──
    // Räknar world-AABB för hela kroppen efter att alla rotationer
    // applicerats. Om lägsta punkten är under golvet lyfter vi root med
    // exakt den differensen så gymnasten precis står/hänger på golvet
    // istället för att klippa igenom det.
    if (floorClamp && rootRef.current) {
      rootRef.current.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rootRef.current);
      if (isFinite(box.min.y) && box.min.y < 0) {
        rootRef.current.position.y -= box.min.y;
      }
    }
  }, [pose, def.baseRotY, baseY, bodyRefs, floorClamp]);

  return (
    <>
      {eq && <Equipment3D type={eq.type} />}
      <group ref={rootRef} position={[0, baseY, 0]}>
        <GymnastBody color={color} skin="#E8C99A" hair="#2d1a08" refs={bodyRefs} />
      </group>
    </>
  );
}

export function PosePreview({ pose, def, apparatus, color }: Props) {
  const eq = equipmentForApparatus(apparatus);
  // Sikta kameran lite ovanför mitten för bar-exercises så hela
  // redskapet + hängande kropp syns. För golv-tricks låg mitt.
  const target: [number, number, number] = eq?.mount === "hang-bar"
    ? [0, (eq.type.physicalHeightM - 0.5), 0]
    : eq?.mount === "support-bar"
    ? [0, eq.type.physicalHeightM * 0.75, 0]
    : [0, 0.9, 0];

  return (
    <Canvas
      shadows
      camera={{ position: [2.6, 1.8, 3.2], fov: 40 }}
      style={{ background: "#94a3b8", width: "100%", height: "100%" }}
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
        cellColor="#475569"
        sectionSize={2}
        sectionColor="#1e293b"
        fadeDistance={10}
        infiniteGrid
      />
      {/* Golv-plan: ogenomskinlig grå yta + mörkare mottagarplan för
          skuggor. Placeras y = -0.001 så grid-linjerna ritas ovanpå. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#64748b" roughness={1} />
      </mesh>
      <RiggedGymnast pose={pose} def={def} apparatus={apparatus} color={color} />
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={8}
        target={target}
      />
    </Canvas>
  );
}
