import { Component, Suspense, useRef, useEffect, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
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
import { EffectsLayer, type EffectsHandle } from "./EffectsLayer";
import { RemoteGymnast3D } from "./RemoteGymnast3D";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { exercisesForKind } from "../../catalog/exercises";
import { computeStackInfo } from "../../lib/stackGroups";
import { useGameConfig, isProffsMode } from "../../store/useGameConfig";
import { PROFFS_HALL, PROFFS_STATION } from "../../catalog/proffsArena";
import type { Station } from "../../types";
import {
  composeA4Page,
  orientationForAspect,
  A4_LONG_MM,
  A4_SHORT_MM,
} from "../../lib/a4Compose";
import { A4CropGuide } from "../A4CropGuide";

type Props = { className?: string };

// ---------------------------------------------------------------------------
// Tyst felgräns för icke-kritiska R3F-barn (t.ex. HDR-Environment på äldre
// iPad/Safari där RGBE-loadern kan smälla). Vi fångar felet och renderar
// ingenting, så 3D-vyn i övrigt är fortfarande användbar.
// ---------------------------------------------------------------------------
class SilentR3FBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[3D] non-fatal:", err?.message ?? err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Pre-flight WebGL-sanity: three.js kraschar på äldre iPads med
 * "null is not an object (evaluating 'G.indexOf')" när getParameter
 * returnerar null (WebGLCapabilities läser VERSION-strängen och
 * anropar .indexOf direkt). Kör samma anrop själva i en throwaway-
 * canvas — om det fallerar monterar vi inte R3F alls, utan visar
 * ett vänligt meddelande istället för att krascha och bounce:a till
 * error-boundaryn.
 */
function isWebGLHealthy(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGLRenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext(
        "experimental-webgl",
      ) as WebGLRenderingContext | null);
    if (!gl) return false;
    const version = gl.getParameter(gl.VERSION);
    if (!version || typeof version !== "string") return false;
    const sl = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
    if (!sl || typeof sl !== "string") return false;
    const exts = gl.getSupportedExtensions();
    if (!Array.isArray(exts)) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/** Ritar en rundad rektangel-kontur på en 2D-canvas. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * Ritar en anteckningsbubbla med dashed konnektorlinje till redskapet.
 * Används vid export eftersom drei:s <Html>-overlay inte syns i WebGL-snapshot.
 */
function drawBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  eqCx: number,
  eqCy: number,
  dpr: number,
) {
  const FONT = 11 * dpr;
  const PX = 7 * dpr;
  const PY = 7 * dpr;
  const DEFAULT_W = 130 * dpr;
  const MIN_W = 15 * dpr;
  const LINE = 14 * dpr;
  const RADIUS = 6 * dpr;

  ctx.save();
  ctx.font = `${FONT}px system-ui, sans-serif`;
  ctx.textBaseline = "top";

  // Word-wrap varje rad (respekterar \n). Bredden matchar 2D-anteckningens
  // default så att både editor och export känns konsistenta.
  const availText = DEFAULT_W - PX * 2;
  const lines: string[] = [];
  text.split("\n").forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > availText && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
  });

  const boxW = Math.max(MIN_W, DEFAULT_W);
  const boxH = lines.length * LINE + PY * 2;
  const left = cx - boxW / 2;
  const top = cy - boxH / 2;

  // Dashed konnektor eq → note
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1 * dpr;
  ctx.setLineDash([5 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(eqCx, eqCy);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bubbla – cream + gold som i 2D
  ctx.fillStyle = "rgba(255,251,210,0.96)";
  ctx.strokeStyle = "#D4A820";
  ctx.lineWidth = 1 * dpr;
  roundRectPath(ctx, left, top, boxW, boxH, RADIUS);
  ctx.fill();
  ctx.stroke();

  // Text
  ctx.fillStyle = "#374151";
  lines.forEach((l, i) => {
    ctx.fillText(l, left + PX, top + PY + i * LINE);
  });

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Inner scene – lives inside Canvas so it can call useThree
// ---------------------------------------------------------------------------

/** Render alla fjärrspelare i det aktiva multiplayer-rummet. */
function RemotePlayers() {
  const players = useMultiplayerStore((s) => s.players);
  const ids = Object.keys(players);
  if (!ids.length) return null;
  return (
    <>
      {ids.map((id) => (
        <RemoteGymnast3D key={id} player={players[id]} />
      ))}
    </>
  );
}

function HallScene({ W, H, joystickRef, mountTriggerRef, speedRef, cameraResetRef, cameraOrbitRef, freeCamEnabled, effectsRef, onNearEquipment, onMountedExercises, onFreeCamChange }: {
  W: number; H: number;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  cameraOrbitRef: React.MutableRefObject<{ yaw: number; pitch: number; distScale: number }>;
  freeCamEnabled: boolean;
  effectsRef: React.MutableRefObject<EffectsHandle | null>;
  onNearEquipment: (name: string | null) => void;
  onMountedExercises: (info: MountedExerciseInfo | null) => void;
  onFreeCamChange: (on: boolean) => void;
}) {
  const plan = usePlanStore((s) => s.plan);
  const planStation = plan.stations.find((s) => s.id === plan.activeStationId);
  const gameModeActive = usePlanStore((s) => s.gameMode);
  const difficulty = useGameConfig((s) => s.difficulty);
  // I proffs-läget visas alltid samma fasta arena — oberoende av användarens
  // egna planer — så att highscore mellan spelare är jämförbart. I plan- och
  // övriga spellägen används den aktiva stationen som vanligt.
  const proffsArenaActive = gameModeActive && isProffsMode(difficulty);
  const station = proffsArenaActive ? PROFFS_STATION : planStation;
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
    const currentPlan = () => usePlanStore.getState().plan;
    const safeName = (s: string) =>
      s.replace(/[^\w\-]+/g, "_").slice(0, 60) || "pass";

    // Rita anteckningsbubblor direkt på 2D-canvasen vid export. HTML-overlays
    // från drei <Html> hamnar inte i WebGL-snapshoten, så vi projicerar
    // positionen manuellt och ritar en liknande bubbla med dashed konnektor.
    const drawNotesOnCanvas = (
      ctx: CanvasRenderingContext2D,
      dx: number,
      dy: number,
    ) => {
      const plan = currentPlan();
      const active = plan.stations.find((s) => s.id === plan.activeStationId);
      if (!active) return;
      const showNotes = usePlanStore.getState().showNotes;
      if (!showNotes) return;
      const stackInfo = computeStackInfo(active.equipment);
      const canvasW = gl.domElement.width;
      const canvasH = gl.domElement.height;
      const dpr = Math.max(1, canvasW / Math.max(1, gl.domElement.clientWidth));

      // Hitta equipment-grupper i scenen efter namn → snabbare lookup
      const groupByEqId = new Map<string, THREE.Object3D>();
      scene.traverse((obj) => {
        if (obj.name && obj.name.startsWith("eq-")) {
          groupByEqId.set(obj.name.slice(3), obj);
        }
      });

      active.equipment.forEach((eq) => {
        if (!eq.notes) return;
        const type = getEquipmentById(eq.typeId);
        if (!type) return;
        const sInfo = stackInfo.get(eq.id);
        if (sInfo && !sInfo.isLeader) return;
        const group = groupByEqId.get(eq.id);
        if (!group) return;

        const noteOffX = eq.noteOffset?.x ?? type.widthM / 2 + 0.6;
        const noteOffZ = eq.noteOffset?.y ?? -(type.heightM / 2 + 0.6);

        const noteLocal = new THREE.Vector3(
          noteOffX,
          type.physicalHeightM + 0.5,
          noteOffZ,
        );
        const noteWorld = group.localToWorld(noteLocal.clone()).project(camera);
        const nsx = ((noteWorld.x + 1) / 2) * canvasW;
        const nsy = ((1 - noteWorld.y) / 2) * canvasH;

        const eqLocal = new THREE.Vector3(0, type.physicalHeightM * 0.7, 0);
        const eqWorld = group.localToWorld(eqLocal.clone()).project(camera);
        const esx = ((eqWorld.x + 1) / 2) * canvasW;
        const esy = ((1 - eqWorld.y) / 2) * canvasH;

        drawBubble(
          ctx,
          eq.notes,
          nsx + dx,
          nsy + dy,
          esx + dx,
          esy + dy,
          dpr,
        );
      });
    };

    // Exporterna görs på off-screen-canvasar som kan bli stora på
    // iPad (DPR×skärmstorlek). För att undvika OOM-krascher i Safari
    // skalar vi ner källan om den är större än MAX_EXPORT_DIM, och
    // använder toBlob + object-URL istället för toDataURL (base64
    // allokerar ~4/3× källans pixelvolym i strängform).
    //
    // Touch-enheter (iPad) har strängare minnesbudget → något lägre
    // tak + lägre DPR-bump. Desktop renderas skarpare.
    const isTouch =
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches;
    const MAX_EXPORT_DIM = isTouch ? 2400 : 3200;

    const computeScale = (srcW: number, srcH: number) => {
      const longest = Math.max(srcW, srcH);
      return longest > MAX_EXPORT_DIM ? MAX_EXPORT_DIM / longest : 1;
    };

    // Renderar scenen med tillfälligt högre pixel ratio så att
    // framebufferten vi snapshottar blir skarpare än default R3F-
    // rendering (som ofta är begränsad till dpr=1-2 för prestanda).
    // Restorerar originalet i en finally.
    const withHiResRender = <T,>(fn: () => T): T => {
      const origPR = gl.getPixelRatio();
      const origSize = new THREE.Vector2();
      gl.getSize(origSize);
      const targetPR = isTouch
        ? Math.max(origPR, 2)
        : Math.max(origPR, 2.5);
      const bumped = targetPR > origPR + 0.01;
      try {
        if (bumped) {
          gl.setPixelRatio(targetPR);
          gl.setSize(origSize.x, origSize.y, false);
        }
        gl.render(scene, camera);
        return fn();
      } finally {
        if (bumped) {
          gl.setPixelRatio(origPR);
          gl.setSize(origSize.x, origSize.y, false);
          gl.render(scene, camera);
        }
      }
    };

    // Kopierar gl.domElement till en off-screen canvas (nedskalad om
    // källan är större än MAX_EXPORT_DIM) och ritar note-bubblor över.
    // Resultatet skickas sedan till composeA4Page som center-croppar
    // in det i en A4-sida.
    const snapshotCanvas = (): HTMLCanvasElement | null => {
      const src = gl.domElement;
      const scale = computeScale(src.width, src.height);
      const imgW = Math.round(src.width * scale);
      const imgH = Math.round(src.height * scale);
      const out = document.createElement("canvas");
      out.width = imgW;
      out.height = imgH;
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, imgW, imgH);
      ctx.save();
      ctx.scale(scale, scale);
      drawNotesOnCanvas(ctx, 0, 0);
      ctx.restore();
      return out;
    };

    const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    const onExportPng = () => {
      try {
        const plan = currentPlan();
        const raw = withHiResRender(() => snapshotCanvas());
        if (!raw) return;
        const orient = orientationForAspect(raw.width, raw.height);
        const page = composeA4Page(raw, {
          orient,
          title: plan.name,
          subtitle: plan.hall.name,
        });
        page.toBlob((blob) => {
          if (!blob) return;
          downloadBlob(blob, `${safeName(plan.name)}-3d.png`);
        }, "image/png");
      } catch (err) {
        console.warn("[3D] PNG-export misslyckades:", err);
      }
    };

    const onExportPdf = async () => {
      try {
        const plan = currentPlan();
        const raw = withHiResRender(() => snapshotCanvas());
        if (!raw) return;
        const orient = orientationForAspect(raw.width, raw.height);
        const page = composeA4Page(raw, {
          orient,
          title: plan.name,
          subtitle: plan.hall.name,
        });
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: orient,
          unit: "mm",
          format: "a4",
        });
        const pw = orient === "landscape" ? A4_LONG_MM : A4_SHORT_MM;
        const ph = orient === "landscape" ? A4_SHORT_MM : A4_LONG_MM;
        pdf.addImage(page, "PNG", 0, 0, pw, ph);
        pdf.save(`${safeName(plan.name)}-3d.pdf`);
      } catch (err) {
        console.warn("[3D] PDF-export misslyckades:", err);
      }
    };

    const pdfWrapper = () => { void onExportPdf(); };

    window.addEventListener("gymnastik:export-3d-png", onExportPng);
    window.addEventListener("gymnastik:export-3d-pdf", pdfWrapper);
    return () => {
      window.removeEventListener("gymnastik:export-3d-png", onExportPng);
      window.removeEventListener("gymnastik:export-3d-pdf", pdfWrapper);
    };
  }, [gl, scene, camera]);

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
        // Matcha 2D-bubblans bredd/höjd om användaren ändrat storlek där,
        // annars använd samma default som 2D-editorn (130 × 56 CSS-px).
        const noteW = Math.max(15, eq.noteSize?.w ?? 130);
        const noteH = Math.max(24, eq.noteSize?.h ?? 56);

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
                        background: "rgba(255,251,210,0.98)",
                        border: "2px solid #3B82F6",
                        borderRadius: "6px",
                        padding: "7px",
                        fontSize: "11px",
                        color: "#374151",
                        width: `${noteW}px`,
                        minWidth: "15px",
                        minHeight: `${noteH}px`,
                        fontFamily: "system-ui, sans-serif",
                        resize: "both",
                        outline: "none",
                        lineHeight: `${14 / 11}`,
                        whiteSpace: "pre-wrap",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
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
                        background: "rgba(255,251,210,0.96)",
                        border: "1px solid #D4A820",
                        borderRadius: "6px",
                        padding: "7px",
                        fontSize: "11px",
                        color: "#374151",
                        width: `${noteW}px`,
                        minWidth: "15px",
                        fontFamily: "system-ui, sans-serif",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        lineHeight: `${14 / 11}`,
                        cursor: "grab",
                        userSelect: "none",
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
          effectsRef={effectsRef}
          onNearEquipment={onNearEquipment}
          onMountedExercises={onMountedExercises}
          onFreeCamChange={onFreeCamChange}
          onExit={() => setGameMode(false)}
        />
      )}
      {gameMode && <EffectsLayer ref={effectsRef} />}
      {gameMode && <RemotePlayers />}
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
  const difficulty  = useGameConfig((s) => s.difficulty);

  // Proffs-läget tvingar fast arena-storlek. Övriga lägen följer användarens plan.
  const proffsArenaActive = gameMode && isProffsMode(difficulty);
  const W = proffsArenaActive ? PROFFS_HALL.widthM  : plan.hall.widthM;
  const H = proffsArenaActive ? PROFFS_HALL.heightM : plan.hall.heightM;
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
  const effectsRef = useRef<EffectsHandle | null>(null);
  const [glHealthy] = useState(() => isWebGLHealthy());
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!glHealthy) {
    return (
      <div
        className={className}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          color: "#F1F5F9",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            3D-vyn kan inte köras på den här enheten
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>
            Din iPad eller webbläsare saknar WebGL-stöd som 3D-vyn kräver.
            Använd 2D-editorn istället — den fungerar på alla enheter.
          </div>
          <button
            type="button"
            onClick={() => usePlanStore.getState().setViewMode("2D")}
            style={{
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tillbaka till 2D
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className} style={{ position: "relative" }}>
      <A4CropGuide containerRef={containerRef} />
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
          // "default" är mer förlåtande än "high-performance" på äldre
          // iPads där drivrutinen annars kan neka context-creation.
          powerPreference: "default",
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false,
        }}
      >
        <color attach="background" args={["#FFFFFF"]} />
        {/* Mjuk fog: börjar först långt bortom hallen och faller ut ännu längre bort,
            så läsbarheten i utkanterna inte försämras. */}
        <fog attach="fog" args={["#FFFFFF", camDist * 3, camDist * 7]} />

        <SilentR3FBoundary>
          <Suspense fallback={null}>
            <Environment preset="city" background={false} environmentIntensity={0.15} />
          </Suspense>
        </SilentR3FBoundary>

        <HallScene
          W={W} H={H}
          joystickRef={joystickRef}
          mountTriggerRef={mountTriggerRef}
          speedRef={speedRef}
          cameraResetRef={cameraResetRef}
          cameraOrbitRef={cameraOrbitRef}
          freeCamEnabled={freeCamEnabled}
          effectsRef={effectsRef}
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
