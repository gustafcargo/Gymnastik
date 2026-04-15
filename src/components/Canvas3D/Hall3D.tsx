import { Suspense, useRef, useEffect, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  Grid,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { usePlanStore } from "../../store/usePlanStore";
import { EQUIPMENT_BY_ID } from "../../catalog/equipment";
import { Equipment3D } from "./Equipment3D";
import type { Station } from "../../types";

type Props = { className?: string };

// ---------------------------------------------------------------------------
// Inner scene – lives inside Canvas so it can call useThree
// ---------------------------------------------------------------------------

function HallScene({ W, H }: { W: number; H: number }) {
  const plan = usePlanStore((s) => s.plan);
  const station = plan.stations.find((s) => s.id === plan.activeStationId);
  const selectedId = usePlanStore((s) => s.selectedEquipmentId);
  const selectEquipment = usePlanStore((s) => s.selectEquipment);
  const moveEquipment = usePlanStore((s) => s.moveEquipment);
  const openEquipmentEditor = usePlanStore((s) => s.openEquipmentEditor);

  const cx = W / 2;
  const cz = H / 2;

  const { camera, gl, scene } = useThree();
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef({ dx: 0, dz: 0 });
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitPoint = useRef(new THREE.Vector3());
  const raycaster = useRef(new THREE.Raycaster());

  // Keep latest station in a ref so event handlers don't go stale
  const stationRef = useRef<Station | undefined>(station);
  useEffect(() => { stationRef.current = station; }, [station]);

  const startDrag = useCallback(
    (eqId: string, point: THREE.Vector3, eqX: number, eqY: number) => {
      draggingId.current = eqId;
      dragOffset.current = { dx: point.x - eqX, dz: point.z - eqY };
      if (orbitRef.current) orbitRef.current.enabled = false;
    },
    [],
  );

  // ── Capture-phase selection ──────────────────────────────────────────────
  // Fires BEFORE OrbitControls can intercept, so left-click reliably selects.
  // stopPropagation() on equipment hits prevents OrbitControls from rotating.
  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0) return; // only primary (left) button
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);

      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.name?.startsWith("eq-")) {
            const eqId = obj.name.slice(3);
            const eq = stationRef.current?.equipment.find((e) => e.id === eqId);
            selectEquipment(eqId);
            if (eq) startDrag(eqId, hit.point, eq.x, eq.y);
            e.stopPropagation(); // keep OrbitControls from rotating
            return;
          }
          obj = obj.parent;
        }
      }
      // Nothing hit – deselect (let OrbitControls orbit normally)
      selectEquipment(null);
    };

    canvas.addEventListener("pointerdown", onPointerDownCapture, { capture: true });
    return () => canvas.removeEventListener("pointerdown", onPointerDownCapture, { capture: true });
  }, [camera, gl, scene, selectEquipment, startDrag]);

  // ── Double-click → open equipment editor ────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;

    const onDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.name?.startsWith("eq-")) {
            selectEquipment(obj.name.slice(3));
            openEquipmentEditor();
            return;
          }
          obj = obj.parent;
        }
      }
    };

    canvas.addEventListener("dblclick", onDblClick);
    return () => canvas.removeEventListener("dblclick", onDblClick);
  }, [camera, gl, scene, selectEquipment, openEquipmentEditor]);

  // ── Drag: move + release ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;

    const onMove = (e: PointerEvent) => {
      if (!draggingId.current) return;
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
      if (raycaster.current.ray.intersectPlane(floorPlane.current, hitPoint.current)) {
        moveEquipment(
          draggingId.current,
          hitPoint.current.x - dragOffset.current.dx,
          hitPoint.current.z - dragOffset.current.dz,
        );
      }
    };

    const onUp = () => {
      if (draggingId.current) {
        draggingId.current = null;
        if (orbitRef.current) orbitRef.current.enabled = true;
      }
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, moveEquipment]);

  // ── Export events ────────────────────────────────────────────────────────
  useEffect(() => {
    const onExportPng = () => {
      const dataUrl = gl.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "hall-3d.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const onExportPdf = async () => {
      const dataUrl = gl.domElement.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = gl.domElement.width;
      const imgH = gl.domElement.height;
      const ratio = Math.min(pageW / imgW, pageH / imgH);
      const w = imgW * ratio;
      const h = imgH * ratio;
      pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save("hall-3d.pdf");
    };

    const pdfWrapper = () => { void onExportPdf(); };

    window.addEventListener("gymnastik:export-3d-png", onExportPng);
    window.addEventListener("gymnastik:export-3d-pdf", pdfWrapper);
    return () => {
      window.removeEventListener("gymnastik:export-3d-png", onExportPng);
      window.removeEventListener("gymnastik:export-3d-pdf", pdfWrapper);
    };
  }, [gl]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[W * 0.4, Math.max(W, H) * 1.2, H * 0.3]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-camera-left={-W}
        shadow-camera-right={W * 2}
        shadow-camera-top={H * 2}
        shadow-camera-bottom={-H}
        shadow-camera-near={0.5}
        shadow-camera-far={Math.max(W, H) * 4}
      />
      <hemisphereLight intensity={0.3} groundColor="#5a6570" color="#c8d8e8" />

      {/* Hallgolv */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, 0, cz]}
        receiveShadow
      >
        <planeGeometry args={[W, H]} />
        <meshPhysicalMaterial
          color="#788C9E"
          roughness={0.32}
          metalness={0.0}
          clearcoat={0.45}
          clearcoatRoughness={0.18}
        />
      </mesh>

      <Grid
        position={[cx, 0.005, cz]}
        args={[W, H]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#637585"
        sectionSize={5}
        sectionThickness={0.7}
        sectionColor="#4E5F6E"
        fadeDistance={Math.max(W, H) * 1.6}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Redskap */}
      {station?.equipment.map((eq) => {
        const type = EQUIPMENT_BY_ID[eq.typeId];
        if (!type) return null;
        const isSelected = eq.id === selectedId;

        return (
          <group
            key={eq.id}
            name={`eq-${eq.id}`}
            position={[eq.x, eq.z ?? 0, eq.y]}
            rotation={[0, -(eq.rotation * Math.PI) / 180, 0]}
            scale={[eq.scaleX, 1, eq.scaleY]}
          >
            <Equipment3D
              type={type}
              color={eq.customColor}
              partColors={eq.partColors}
              params={eq.params}
            />
            {/* Selection highlight */}
            {isSelected && (
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.006, 0]}
                renderOrder={1}
              >
                <planeGeometry
                  args={[type.widthM + 0.18, type.heightM + 0.18]}
                />
                <meshBasicMaterial
                  color="#3B82F6"
                  transparent
                  opacity={0.28}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        );
      })}

      <OrbitControls
        ref={orbitRef}
        target={[cx, 0, cz]}
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={Math.max(W, H) * 3}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper
// ---------------------------------------------------------------------------

export function Hall3D({ className }: Props) {
  const plan = usePlanStore((s) => s.plan);

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
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }}
      >
        <color attach="background" args={["#DDE3E8"]} />
        <fog attach="fog" args={["#DDE3E8", camDist * 1.4, camDist * 3]} />

        <Suspense fallback={null}>
          <Environment preset="city" background={false} environmentIntensity={0.6} />
        </Suspense>

        <HallScene W={W} H={H} />
      </Canvas>
    </div>
  );
}
