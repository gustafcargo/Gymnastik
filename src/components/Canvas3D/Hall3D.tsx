import { Suspense, useRef, useEffect, useCallback, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Environment,
  Html,
  Line,
  OrbitControls,
  Grid,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { usePlanStore } from "../../store/usePlanStore";
import { getEquipmentById } from "../../catalog/equipment";
import { Equipment3D } from "./Equipment3D";
import { Gymnast3D } from "./Gymnast3D";
import { GameGymnast3D, type MountedExerciseInfo } from "./GameGymnast3D";
import { GameHUD } from "./GameHUD";
import { exercisesForKind } from "../../catalog/exercises";
import { computeStackInfo } from "../../lib/stackGroups";
import type { Station } from "../../types";

type Props = { className?: string };

// ---------------------------------------------------------------------------
// Inner scene – lives inside Canvas so it can call useThree
// ---------------------------------------------------------------------------

const GYMNAST_COLOR = "#c026d3";

function HallScene({ W, H, joystickRef, mountTriggerRef, speedRef, cameraResetRef, cameraOrbitRef, freeCamEnabled, onNearEquipment, onMountedExercises, onFreeCamChange }: {
  W: number; H: number;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  cameraOrbitRef: React.MutableRefObject<{ yaw: number; pitch: number; distScale: number }>;
  freeCamEnabled: boolean;
  onNearEquipment: (name: string | null) => void;
  onMountedExercises: (info: MountedExerciseInfo | null) => void;
  onFreeCamChange: (on: boolean) => void;
}) {
  const plan = usePlanStore((s) => s.plan);
  const station = plan.stations.find((s) => s.id === plan.activeStationId);
  const selectedId = usePlanStore((s) => s.selectedEquipmentId);
  const selectEquipment = usePlanStore((s) => s.selectEquipment);
  const gameMode = usePlanStore((s) => s.gameMode);
  const setGameMode = usePlanStore((s) => s.setGameMode);
  const moveEquipment = usePlanStore((s) => s.moveEquipment);
  const updateEquipment = usePlanStore((s) => s.updateEquipment);
  const showLabels = usePlanStore((s) => s.showLabels);
  const showNotes = usePlanStore((s) => s.showNotes);
  const snapToGrid = usePlanStore((s) => s.snapToGrid);
  const setEquipmentNoteOffset = usePlanStore((s) => s.setEquipmentNoteOffset);
  const updateGymnast = usePlanStore((s) => s.updateGymnast);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const cx = W / 2;
  const cz = H / 2;

  const stackInfo = useMemo(
    () => computeStackInfo(station?.equipment ?? []),
    [station?.equipment],
  );

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

  // ── Note bubble drag state ────────────────────────────────────────────────
  type Notedrag = {
    id: string;
    eqX: number;
    eqZ: number; // eq.y in 2D space = Z in 3D space
    plane: THREE.Plane;
    offX: number; // live local offset from eq center
    offZ: number;
  };
  const draggingNoteRef = useRef<Notedrag | null>(null);
  // We force re-renders during note drag so the line + bubble position updates live
  const [, setNoteDragTick] = useState(0);

  const startDrag = useCallback(
    (eqId: string, point: THREE.Vector3, eqX: number, eqY: number) => {
      draggingId.current = eqId;
      dragOffset.current = { dx: point.x - eqX, dz: point.z - eqY };
      if (orbitRef.current) orbitRef.current.enabled = false;
    },
    [],
  );

  // ── Note bubble drag (document-level, separate from equipment drag) ───────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const nd = draggingNoteRef.current;
      if (!nd) return;
      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = new THREE.Vector3();
      if (raycaster.current.ray.intersectPlane(nd.plane, hit)) {
        nd.offX = hit.x - nd.eqX;
        nd.offZ = hit.z - nd.eqZ;
        setNoteDragTick((t) => t + 1);
      }
    };
    const onUp = () => {
      const nd = draggingNoteRef.current;
      if (!nd) return;
      setEquipmentNoteOffset(nd.id, { x: nd.offX, y: nd.offZ });
      draggingNoteRef.current = null;
      setNoteDragTick((t) => t + 1);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, setEquipmentNoteOffset]);

  // ── Capture-phase selection ──────────────────────────────────────────────
  // Fires BEFORE OrbitControls can intercept, so left-click reliably selects.
  // stopPropagation() on equipment hits prevents OrbitControls from rotating.
  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDownCapture = (e: PointerEvent) => {
      if (usePlanStore.getState().gameMode) return; // spelläge hanterar input
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
            return;
          }
          obj = obj.parent;
        }
      }
    };

    canvas.addEventListener("dblclick", onDblClick);
    return () => canvas.removeEventListener("dblclick", onDblClick);
  }, [camera, gl, scene, selectEquipment]);

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

    // Use document-level listeners so drags started on HTML overlays (labels) also work
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
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
      {/* Reduced ambient so dark faces stay dark — cube-like shading */}
      <ambientLight intensity={0.18} />
      {/* Primary sun – strong, single direction for clear face differentiation */}
      <directionalLight
        position={[W * 0.5, Math.max(W, H) * 1.3, H * 0.4]}
        intensity={2.8}
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
      {/* Soft fill from the opposite side — just enough to see shadow faces */}
      <directionalLight position={[-W * 0.3, Math.max(W, H) * 0.5, -H * 0.2]} intensity={0.5} />
      <hemisphereLight intensity={0.15} groundColor="#3a4550" color="#b0c0cc" />

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

      {snapToGrid && (
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
      )}

      {/* Redskap */}
      {station?.equipment.map((eq) => {
        const type = getEquipmentById(eq.typeId);
        if (!type) return null;
        const isSelected = eq.id === selectedId;
        const sInfo = stackInfo.get(eq.id);
        // For stacked mats: only the leader shows label/note.
        // I spelläge döljs redskapsetiketter helt — spelaren behöver inte se
        // redigerings-UI:t.
        const showThisLabel = !gameMode && showLabels && (sInfo === undefined || sInfo.isLeader);
        const baseLabel = eq.label ?? type.name;
        const labelText =
          showThisLabel && sInfo && sInfo.count > 1
            ? `${baseLabel} ×${sInfo.count}`
            : baseLabel;
        // Note bubble offset — live during drag, persisted otherwise
        const isDraggingNote = draggingNoteRef.current?.id === eq.id;
        const noteOffX = isDraggingNote
          ? draggingNoteRef.current!.offX
          : (eq.noteOffset?.x ?? type.widthM / 2 + 0.6);
        const noteOffZ = isDraggingNote
          ? draggingNoteRef.current!.offZ
          : (eq.noteOffset?.y ?? -(type.heightM / 2 + 0.6));

        // Tilt transforms (inside equipment group, pre-rotation)
        const physH = type.physicalHeightM;
        const eqW   = type.widthM;
        const eqD   = type.heightM;
        let tiltRot: [number, number, number] = [0, 0, 0];
        let tiltPos: [number, number, number] = [0, 0, 0];
        switch (eq.orientation) {
          case "upside-down":
            tiltRot = [Math.PI, 0, 0];
            tiltPos = [0, physH, 0];
            break;
          case "on-long-side":
            // rotate -90° around Z: (x,y,z)→(y,-x,z); long edge stays along X
            tiltRot = [0, 0, -Math.PI / 2];
            tiltPos = [-physH / 2, eqW / 2, 0];
            break;
          case "on-short-side":
            // rotate -90° around X: (x,y,z)→(x,z,-y); short edge stays along Z
            tiltRot = [-Math.PI / 2, 0, 0];
            tiltPos = [0, eqD / 2, physH / 2];
            break;
        }
        const hasTilt = eq.orientation && eq.orientation !== "normal";

        return (
          <group
            key={eq.id}
            name={`eq-${eq.id}`}
            position={[eq.x, eq.z ?? 0, eq.y]}
            rotation={[0, -(eq.rotation * Math.PI) / 180, 0]}
            scale={[eq.scaleX, 1, eq.scaleY]}
          >
            {hasTilt ? (
              <group position={tiltPos} rotation={tiltRot}>
                <Equipment3D
                  type={type}
                  color={eq.customColor}
                  partColors={eq.partColors}
                  params={eq.params}
                />
              </group>
            ) : (
              <Equipment3D
                type={type}
                color={eq.customColor}
                partColors={eq.partColors}
                params={eq.params}
              />
            )}
            {/* Gymnasts — scale-korrigerad grupp */}
            {eq.gymnasts?.map((g) => (
              <group key={g.id} scale={[1 / eq.scaleX, 1, 1 / eq.scaleY]}>
                <Gymnast3D
                  exerciseId={g.exerciseId}
                  color={g.color}
                  equipmentType={type}
                />
              </group>
            ))}
            {/* Övningsväljare – visas vid redskapet när gymnast finns */}
            {(() => {
              const gymnast = eq.gymnasts?.[0];
              if (!gymnast) return null;
              const kind = type.detail?.kind ?? "";
              const exercises = kind ? exercisesForKind(kind) : [];
              if (!exercises.length) return null;
              return (
                <Html
                  position={[0, type.physicalHeightM + 0.45, 0]}
                  center
                  style={{ pointerEvents: "all" }}
                  zIndexRange={[30, 40]}
                >
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      background: "rgba(10,18,32,0.82)",
                      backdropFilter: "blur(6px)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.10)",
                      padding: "5px 7px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontFamily: "system-ui, sans-serif",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>🤸</span>
                    <select
                      value={gymnast.exerciseId}
                      onChange={(e) => updateGymnast(eq.id, gymnast.id, { exerciseId: e.target.value })}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "5px",
                        color: "#f1f5f9",
                        fontSize: "11px",
                        padding: "2px 4px",
                        cursor: "pointer",
                        maxWidth: "130px",
                      }}
                    >
                      {exercises.map((ex) => (
                        <option key={ex.id} value={ex.id} style={{ color: "#0f172a", background: "#fff" }}>
                          {ex.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </Html>
              );
            })()}
            {/* Floating label — click to select, drag to move equipment */}
            {showThisLabel && (
              <Html
                position={[0, type.physicalHeightM + 0.28, 0]}
                center
                style={{ pointerEvents: "all" }}
                zIndexRange={[10, 20]}
              >
                <div
                  style={{
                    background: isSelected
                      ? "rgba(59,130,246,0.92)"
                      : "rgba(15,23,42,0.82)",
                    color: "#fff",
                    borderRadius: "5px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    fontFamily: "system-ui, sans-serif",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    transform: `scale(${1 / Math.max(eq.scaleX, eq.scaleY, 0.5)})`,
                    cursor: draggingId.current === eq.id ? "grabbing" : "grab",
                    userSelect: "none",
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.target as Element).setPointerCapture(e.pointerId);
                    selectEquipment(eq.id);
                    // Project pointer to floor to compute initial offset
                    const rect = gl.domElement.getBoundingClientRect();
                    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
                    const hit = new THREE.Vector3();
                    if (raycaster.current.ray.intersectPlane(floorPlane.current, hit)) {
                      startDrag(eq.id, hit, eq.x, eq.y);
                    } else {
                      draggingId.current = eq.id;
                      dragOffset.current = { dx: 0, dz: 0 };
                      if (orbitRef.current) orbitRef.current.enabled = false;
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    selectEquipment(eq.id);
                  }}
                >
                  {labelText}
                </div>
              </Html>
            )}
            {/* Note bubble */}
            {showNotes && eq.notes && (showThisLabel || !sInfo) && (
              <>
                {/* Dashed connector line from equipment top-center to bubble */}
                <Line
                  points={[
                    [0, type.physicalHeightM * 0.7, 0],
                    [noteOffX, type.physicalHeightM + 0.45, noteOffZ],
                  ]}
                  color="#475569"
                  lineWidth={1}
                  dashed
                  dashScale={6}
                />
                <Html
                  position={[noteOffX, type.physicalHeightM + 0.5, noteOffZ]}
                  center
                  style={{ pointerEvents: "all" }}
                  zIndexRange={[15, 25]}
                >
                  {editingNoteId === eq.id ? (
                    <textarea
                      autoFocus
                      defaultValue={eq.notes ?? ""}
                      onBlur={(e) => {
                        updateEquipment(eq.id, { notes: e.target.value || undefined });
                        setEditingNoteId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingNoteId(null);
                        e.stopPropagation();
                      }}
                      style={{
                        background: "rgba(255,255,255,0.97)",
                        border: "2px solid #3B82F6",
                        borderRadius: "8px",
                        padding: "5px 10px",
                        fontSize: "12px",
                        color: "#1e293b",
                        width: "160px",
                        minHeight: "64px",
                        fontFamily: "system-ui, sans-serif",
                        resize: "none",
                        outline: "none",
                        lineHeight: "1.45",
                      }}
                    />
                  ) : (
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.target as Element).setPointerCapture(e.pointerId);
                        const yPlane = (eq.z ?? 0) + type.physicalHeightM + 0.5;
                        draggingNoteRef.current = {
                          id: eq.id,
                          eqX: eq.x,
                          eqZ: eq.y,
                          plane: new THREE.Plane(
                            new THREE.Vector3(0, 1, 0),
                            -yPlane,
                          ),
                          offX: noteOffX,
                          offZ: noteOffZ,
                        };
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingNoteId(eq.id);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.92)",
                        border: "1.5px solid rgba(100,116,139,0.45)",
                        borderRadius: "8px",
                        padding: "5px 10px",
                        fontSize: "12px",
                        fontWeight: 450,
                        color: "#1e293b",
                        width: "160px",
                        fontFamily: "system-ui, sans-serif",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.14)",
                        wordBreak: "break-word",
                        whiteSpace: "normal",
                        lineHeight: "1.45",
                        cursor: "grab",
                        userSelect: "none",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {eq.notes}
                    </div>
                  )}
                </Html>
              </>
            )}
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
        enabled={!gameMode || freeCamEnabled}
      />

      {gameMode && station && (
        <GameGymnast3D
          station={station}
          hallW={W}
          hallH={H}
          joystickRef={joystickRef}
          mountTriggerRef={mountTriggerRef}
          speedRef={speedRef}
          cameraResetRef={cameraResetRef}
          cameraOrbitRef={cameraOrbitRef}
          color={GYMNAST_COLOR}
          onNearEquipment={onNearEquipment}
          onMountedExercises={onMountedExercises}
          onFreeCamChange={onFreeCamChange}
          onExit={() => setGameMode(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper
// ---------------------------------------------------------------------------

export function Hall3D({ className }: Props) {
  const plan        = usePlanStore((s) => s.plan);
  const gameMode    = usePlanStore((s) => s.gameMode);
  const setGameMode = usePlanStore((s) => s.setGameMode);

  const W = plan.hall.widthM;
  const H = plan.hall.heightM;
  const cx = W / 2;
  const cz = H / 2;
  const camDist = Math.max(W, H) * 0.95;

  // Refs delas mellan HallScene (Canvas) och GameHUD (DOM overlay)
  const joystickRef     = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 });
  const mountTriggerRef = useRef(false);
  const speedRef        = useRef(2.2);
  const cameraResetRef  = useRef(false);
  // Touch-orbit: dragning + pinch påverkar yaw-offset, pitch och avstånd
  const cameraOrbitRef  = useRef<{ yaw: number; pitch: number; distScale: number }>({
    yaw: 0, pitch: 0, distScale: 1,
  });
  const [nearEquipment, setNearEquipment] = useState<string | null>(null);
  const [mountedExerciseInfo, setMountedExerciseInfo] = useState<MountedExerciseInfo | null>(null);
  const [freeCamEnabled, setFreeCamEnabled] = useState(false);

  return (
    <div className={className} style={{ position: "relative" }}>
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
          <Environment preset="city" background={false} environmentIntensity={0.15} />
        </Suspense>

        <HallScene
          W={W} H={H}
          joystickRef={joystickRef}
          mountTriggerRef={mountTriggerRef}
          speedRef={speedRef}
          cameraResetRef={cameraResetRef}
          cameraOrbitRef={cameraOrbitRef}
          freeCamEnabled={freeCamEnabled}
          onNearEquipment={setNearEquipment}
          onMountedExercises={setMountedExerciseInfo}
          onFreeCamChange={setFreeCamEnabled}
        />
      </Canvas>

      {gameMode && (
        <>
          <GameHUD
            nearEquipment={nearEquipment}
            mountedExerciseInfo={mountedExerciseInfo}
            joystickRef={joystickRef}
            mountTriggerRef={mountTriggerRef}
            speedRef={speedRef}
            cameraResetRef={cameraResetRef}
            cameraOrbitRef={cameraOrbitRef}
            freeCamActive={freeCamEnabled}
            onExit={() => { setGameMode(false); setMountedExerciseInfo(null); setFreeCamEnabled(false); }}
          />

        </>
      )}
    </div>
  );
}
