/**
 * GameHUD – overlay för spelläget.
 * Desktop: text-hints + avsluta-knapp.
 * Touch: virtuell joystick (vänster) + hoppa-upp-knapp (höger).
 */
import { useEffect, useRef, useState } from "react";
import { Camera, X, Sparkles, Volume2, VolumeX, Gamepad2, Dumbbell, Trophy, Timer, Play } from "lucide-react";
import type { MountedExerciseInfo } from "./GameGymnast3D";
import { GymnastStylePanel } from "./GymnastStylePanel";
import { useAudioStore } from "../../store/useAudioStore";
import { useGameConfig, isProffsMode } from "../../store/useGameConfig";
import { useGameScore } from "../../store/useGameScore";
import { useGameMode } from "../../store/useGameMode";
import { useMultiplayerStore } from "../../store/useMultiplayerStore";
import { isMultiplayerEnabled } from "../../lib/multiplayer";
import { RoomPanel } from "./RoomPanel";
import { InviteModal } from "./InviteModal";
import { TrickOverlay } from "./TrickOverlay";
import { RoundOverlay, RoundTimer } from "./RoundOverlay";
import { Leaderboard } from "./Leaderboard";
import { FailToast } from "./FailToast";
import { ClearToast } from "./ClearToast";
import { PreGameMenu } from "./PreGameMenu";
import { EndGameSummary } from "./EndGameSummary";
import { PROFFS_STATION } from "../../catalog/proffsArena";
import { getEquipmentById } from "../../catalog/equipment";
import { exercisesForKind } from "../../catalog/exercises";
import { BUILT_IN_EXERCISES } from "./Gymnast3D";
import { useCustomExercisesStore } from "../../store/useCustomExercisesStore";

type Props = {
  nearEquipment: string | null;
  mountedExerciseInfo: MountedExerciseInfo | null;
  joystickRef: React.MutableRefObject<{ dx: number; dz: number }>;
  mountTriggerRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  cameraOrbitRef: React.MutableRefObject<{ yaw: number; pitch: number; distScale: number }>;
  freeCamActive: boolean;
  onExit: () => void;
};

export function GameHUD({ nearEquipment, mountedExerciseInfo, joystickRef, mountTriggerRef, speedRef, cameraResetRef, cameraOrbitRef, freeCamActive, onExit }: Props) {
  const [isTouch, setIsTouch] = useState(false);
  const [speedDisplay, setSpeedDisplay] = useState(speedRef.current);
  const [styleOpen, setStyleOpen] = useState(false);
  // Pre-game-menyn ska alltid visas när spelläget öppnas. GameHUD monteras
  // fresh varje gång gameMode flippar till true, så useState(false) återställs
  // automatiskt vid ny session.
  const [started, setStarted] = useState(false);
  // End-summary visas när spelaren trycker "Avsluta spelläge" och har poäng att
  // visa upp. Gäller primärt fri-läge (tävling har sin egen scorecard).
  const [showEndSummary, setShowEndSummary] = useState(false);
  // Lokalt failedEquipment-set för auto-end i proffs-läget: när spelaren låst
  // alla poänggivande redskap (MAX_ATTEMPTS_PER_EQUIPMENT uppnått på samtliga)
  // avslutas spelet automatiskt och sammanfattningen visas.
  const failedEquipment = useGameScore((s) => s.failedEquipment);
  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggle);
  const difficulty = useGameConfig((s) => s.difficulty);
  const toggleDifficulty = useGameConfig((s) => s.toggleDifficulty);
  const gameMode = useGameMode((s) => s.gameMode);
  const roundState = useGameMode((s) => s.roundState);
  const lifetimeBest = useGameScore((s) => s.lifetimeBestTavling);
  const [difficultyHintSeen, setDifficultyHintSeen] = useState<boolean>(() => {
    try { return localStorage.getItem("gymnast-difficulty-hint-seen") === "1"; }
    catch { return true; }
  });
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const joyKnobRef = useRef<HTMLDivElement>(null);
  // Kamera-drag + pinch (touch)
  const camPointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);

  useEffect(() => {
    const check = () => setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    check();
    window.matchMedia("(pointer: coarse)").addEventListener("change", check);
    return () => window.matchMedia("(pointer: coarse)").removeEventListener("change", check);
  }, []);

  // Lobby-anslutning bara under spelläget. `GameHUD` mountas just då, så
  // vi använder dess livscykel som signal.
  useEffect(() => {
    if (!isMultiplayerEnabled) return;
    const mp = useMultiplayerStore.getState();
    void mp.connectLobby();
    return () => {
      void useMultiplayerStore.getState().disconnectLobby();
    };
  }, []);

  // Auto-end i proffs-läget: när spelaren har använt alla försök på samtliga
  // poänggivande redskap i proffs-arenan triggas sammanfattningen. Listan
  // över förväntade redskap är hämtad ur PROFFS_STATION, filtrerad till
  // redskap som faktiskt har minst en scoring-övning.
  useEffect(() => {
    if (!isProffsMode(difficulty)) return;
    if (!started || showEndSummary) return;
    const customDefs = useCustomExercisesStore.getState().customExercises.reduce(
      (acc, e) => {
        acc[e.id] = e;
        return acc;
      },
      {} as Record<string, unknown>,
    );
    const hasScoringExercise = (kind: string) => {
      const list = exercisesForKind(kind);
      return list.some((ex) => {
        const def = (customDefs[ex.id] as { tricks?: unknown[]; holdZones?: unknown[] } | undefined)
          ?? (BUILT_IN_EXERCISES as Record<string, { tricks?: unknown[]; holdZones?: unknown[] }>)[ex.id];
        if (!def) return false;
        return (def.tricks?.length ?? 0) > 0 || (def.holdZones?.length ?? 0) > 0;
      });
    };
    const playableIds = PROFFS_STATION.equipment
      .filter((eq) => {
        const type = getEquipmentById(eq.typeId);
        const kind = type?.detail?.kind ?? "";
        return kind ? hasScoringExercise(kind) : false;
      })
      .map((eq) => eq.id);
    if (playableIds.length === 0) return;
    const allLocked = playableIds.every((id) => failedEquipment.includes(id));
    if (allLocked) setShowEndSummary(true);
  }, [difficulty, started, showEndSummary, failedEquipment]);

  // ── Joystick-logik ──────────────────────────────────────────────────────────
  const onJoyDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const onJoyMove = (e: React.PointerEvent) => {
    if (joyPointerId.current !== e.pointerId || !joyOrigin.current) return;
    const maxR = 40;
    let dx = e.clientX - joyOrigin.current.x;
    let dz = e.clientY - joyOrigin.current.y;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > maxR) { dx = dx / len * maxR; dz = dz / len * maxR; }
    joystickRef.current = { dx: dx / maxR, dz: dz / maxR };
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(${dx}px, ${dz}px)`;
    }
  };

  const onJoyUp = (e: React.PointerEvent) => {
    if (joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = null;
    joyOrigin.current = null;
    joystickRef.current = { dx: 0, dz: 0 };
    if (joyKnobRef.current) joyKnobRef.current.style.transform = "translate(0,0)";
  };

  // ── Kameradrag + pinch-zoom (touch, överallt utanför joystick/knappar) ────
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const onCamDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    camPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (camPointers.current.size === 2) {
      const [a, b] = Array.from(camPointers.current.values());
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onCamMove = (e: React.PointerEvent) => {
    const prev = camPointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    camPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (camPointers.current.size === 1) {
      // Enhandsdragning → rotera kamera (yaw + pitch)
      cameraOrbitRef.current.yaw   -= dx * 0.006;
      cameraOrbitRef.current.pitch  = clamp(cameraOrbitRef.current.pitch - dy * 0.004, -0.5, 0.9);
    } else if (camPointers.current.size === 2) {
      // Tvåfingers-pinch → zoom
      const [a, b] = Array.from(camPointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistRef.current != null && pinchDistRef.current > 0) {
        const ratio = pinchDistRef.current / d; // större avstånd = mindre distScale
        cameraOrbitRef.current.distScale = clamp(cameraOrbitRef.current.distScale * ratio, 0.4, 3.5);
      }
      pinchDistRef.current = d;
    }
  };

  const onCamUp = (e: React.PointerEvent) => {
    camPointers.current.delete(e.pointerId);
    if (camPointers.current.size < 2) pinchDistRef.current = null;
  };

  // Pre-game-meny: visa alltid före spel. Döljer hela HUD:et tills spelaren
  // trycker "Spela!". Menyn hanterar exit direkt (utan summary).
  if (!started) {
    return <PreGameMenu onStart={() => setStarted(true)} onExit={onExit} />;
  }

  // End-summary visas i fri-läget när spelaren trycker Avsluta. I tävling
  // sköter RoundOverlay sin egen scorecard så vi släpper onExit rakt igenom.
  const handleExitClick = () => {
    const roundState = useGameMode.getState().roundState;
    const gm = useGameMode.getState().gameMode;
    const sc = useGameScore.getState().score;
    // I tävling visar RoundOverlay redan en scorecard när rundan slutat;
    // om spelaren själv trycker avsluta mitt i rundan låter vi även dem
    // få en summary (för att behålla samma UX som fri-läge).
    if (gm === "tavling" && roundState === "running") {
      // Mid-round avbrott: hoppa direkt ut utan summary (de har redan en
      // tickande timer, blir konstigt att överlagra summary).
      onExit();
      return;
    }
    if (sc > 0) setShowEndSummary(true);
    else onExit();
  };

  if (showEndSummary) {
    return (
      <EndGameSummary
        onPlayAgain={() => {
          useGameScore.getState().resetScore();
          useGameScore.getState().clearFailedEquipment();
          setShowEndSummary(false);
          setStarted(false);
        }}
        onExit={() => {
          setShowEndSummary(false);
          onExit();
        }}
      />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, fontFamily: "system-ui, sans-serif" }}>

      {/* Touch-kamera-lager – ligger bakom alla knappar/joystick, fångar drag + pinch */}
      {isTouch && (
        <div
          onPointerDown={onCamDown}
          onPointerMove={onCamMove}
          onPointerUp={onCamUp}
          onPointerCancel={onCamUp}
          style={{
            position: "absolute", inset: 0,
            pointerEvents: "all", touchAction: "none",
            background: "transparent",
          }}
        />
      )}

      {/* Avsluta-knapp – övre höger */}
      <button
        type="button"
        onClick={handleExitClick}
        style={{
          position: "absolute", top: 14, right: 14,
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(10,18,32,0.78)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
          color: "#f1f5f9", fontSize: 12, fontWeight: 600, padding: "6px 12px",
          cursor: "pointer", pointerEvents: "all",
        }}
      >
        <X size={14} /> Avsluta spelläge
      </button>

      {/* Kamera-reset + fri kamera-indikator – övre höger under avsluta */}
      <div style={{
        position: "absolute", top: 52, right: 14,
        display: "flex", flexDirection: "column", gap: 6, pointerEvents: "all",
      }}>
        <button
          type="button"
          onClick={() => { cameraResetRef.current = true; }}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(10,18,32,0.78)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
            color: "#f1f5f9", fontSize: 11, fontWeight: 600, padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          <Camera size={13} /> Återställ kamera
        </button>
        {freeCamActive && (
          <div style={{
            background: "rgba(59,130,246,0.85)", borderRadius: 8,
            padding: "4px 10px", color: "#fff", fontSize: 10, fontWeight: 600,
            textAlign: "center",
          }}>
            Fri kamera aktiv (F)
          </div>
        )}
      </div>

      {/* Hastighetsreglage – övre höger under kameraknappar */}
      <div style={{
        position: "absolute", top: freeCamActive ? 128 : 92, right: 14,
        background: "rgba(10,18,32,0.78)", backdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
        padding: "6px 10px", pointerEvents: "all", width: 140,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>
          <span>Hastighet</span>
          <span>{speedDisplay.toFixed(1)} m/s</span>
        </div>
        <input
          type="range" min={1.5} max={5} step={0.1}
          value={speedDisplay}
          onChange={(e) => { const v = Number(e.target.value); setSpeedDisplay(v); speedRef.current = v; }}
          style={{ width: "100%", accentColor: "#3B82F6", height: 4 }}
        />
      </div>

      {/* Stil-knapp – öppnar enkel färg-/glitter-editor för barn */}
      <button
        type="button"
        onClick={() => setStyleOpen(true)}
        style={{
          position: "absolute", top: freeCamActive ? 178 : 142, right: 14,
          display: "flex", alignItems: "center", gap: 6,
          background: "linear-gradient(135deg, rgba(236,72,153,0.85), rgba(168,85,247,0.85))",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.25)", borderRadius: 8,
          color: "#fff", fontSize: 11, fontWeight: 700, padding: "6px 12px",
          cursor: "pointer", pointerEvents: "all",
          boxShadow: "0 2px 10px rgba(168,85,247,0.35)",
        }}
      >
        <Sparkles size={13} /> Stil
      </button>

      {/* Ljud-toggle – alla ljud på/av */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Slå på ljud" : "Stäng av ljud"}
        style={{
          position: "absolute", top: freeCamActive ? 214 : 178, right: 14,
          display: "flex", alignItems: "center", gap: 6,
          background: muted ? "rgba(100,116,139,0.78)" : "rgba(10,18,32,0.78)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
          color: "#f1f5f9", fontSize: 11, fontWeight: 600, padding: "6px 12px",
          cursor: "pointer", pointerEvents: "all",
        }}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        {muted ? "Ljud av" : "Ljud på"}
      </button>

      {/* Svårighetsgrad-toggle – auto/manuell/proffs */}
      <div style={{
        position: "absolute", top: freeCamActive ? 250 : 214, right: 14,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
        pointerEvents: "all",
      }}>
        <button
          type="button"
          onClick={() => {
            toggleDifficulty();
            if (!difficultyHintSeen) {
              setDifficultyHintSeen(true);
              try { localStorage.setItem("gymnast-difficulty-hint-seen", "1"); } catch { /* ignore */ }
            }
          }}
          aria-label={`Sv\u00e5righetsgrad: ${difficulty}. Klicka f\u00f6r att byta.`}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background:
              difficulty === "proffs"
                ? "linear-gradient(135deg, rgba(245,158,11,0.92), rgba(234,88,12,0.92))"
                : difficulty === "manuell"
                ? "linear-gradient(135deg, rgba(34,197,94,0.88), rgba(16,185,129,0.88))"
                : "rgba(10,18,32,0.78)",
            backdropFilter: "blur(6px)",
            border: `1px solid ${difficulty === "auto" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.3)"}`,
            borderRadius: 8,
            color: "#f1f5f9", fontSize: 11, fontWeight: 700, padding: "6px 12px",
            cursor: "pointer",
            boxShadow:
              difficulty === "proffs"
                ? "0 2px 10px rgba(245,158,11,0.4)"
                : difficulty === "manuell"
                ? "0 2px 10px rgba(34,197,94,0.35)"
                : "none",
          }}
        >
          {difficulty === "proffs"
            ? <Trophy size={13} />
            : difficulty === "manuell"
              ? <Dumbbell size={13} />
              : <Gamepad2 size={13} />}
          {difficulty === "proffs" ? "Proffs" : difficulty === "manuell" ? "Manuell" : "Auto"}
        </button>
        {difficulty !== "auto" && !difficultyHintSeen && (
          <div style={{
            background: "rgba(15,23,42,0.95)",
            border: `1px solid ${difficulty === "proffs" ? "rgba(245,158,11,0.45)" : "rgba(34,197,94,0.4)"}`,
            borderRadius: 6,
            padding: "5px 9px",
            color: "#cbd5e1", fontSize: 10, fontWeight: 500,
            maxWidth: 200, textAlign: "right", lineHeight: 1.35,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}>
            {difficulty === "proffs"
              ? "T\u00e4vlingsl\u00e4ge: tryck p\u00e5 hopp-knappen exakt vid r\u00e4tt \u00f6gonblick f\u00f6r po\u00e4ng"
              : "Styr \u00f6vningen sj\u00e4lv med joysticken fram\u00e5t/bak\u00e5t"}
          </div>
        )}
      </div>

      {/* Tävlings-läges-toggle + starta-runda — bara synlig när proffs är valt */}
      {isProffsMode(difficulty) && (
        <div style={{
          position: "absolute",
          top: (freeCamActive ? 250 : 214) + 44,
          right: 14,
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
          pointerEvents: "all",
        }}>
          <button
            type="button"
            onClick={() => useGameMode.getState().toggleGameMode()}
            aria-label={`Spell\u00e4ge: ${gameMode}. Klicka f\u00f6r att byta.`}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: gameMode === "tavling"
                ? "linear-gradient(135deg, rgba(239,68,68,0.92), rgba(185,28,28,0.92))"
                : "rgba(10,18,32,0.78)",
              backdropFilter: "blur(6px)",
              border: `1px solid ${gameMode === "tavling" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)"}`,
              borderRadius: 8,
              color: "#f1f5f9", fontSize: 11, fontWeight: 700, padding: "6px 12px",
              cursor: "pointer",
              boxShadow: gameMode === "tavling" ? "0 2px 10px rgba(239,68,68,0.4)" : "none",
            }}
          >
            <Timer size={13} />
            {gameMode === "tavling" ? "T\u00e4vling" : "Fri"}
          </button>
          {gameMode === "tavling" && roundState === "idle" && (
            <button
              type="button"
              onClick={() => {
                useGameScore.getState().resetScore();
                useGameMode.getState().startCountdown();
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 8,
                color: "#fff", fontSize: 11, fontWeight: 800, padding: "6px 12px",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(34,197,94,0.4)",
              }}
            >
              <Play size={13} /> Starta runda
            </button>
          )}
          {gameMode === "tavling" && lifetimeBest > 0 && roundState === "idle" && (
            <div style={{
              fontSize: 10, color: "#94a3b8", fontWeight: 600,
              background: "rgba(10,18,32,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6, padding: "3px 8px",
            }}>
              Personligt rekord: <span style={{ color: "#f59e0b", fontWeight: 800 }}>
                {lifetimeBest.toLocaleString("sv-SE")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Rum-panel uppe till vänster (döljs när övningsmenyn visas där) */}
      {!mountedExerciseInfo && <RoomPanel />}

      {/* Övningsmeny – visas när gymnast är monterad på redskap (uppe till vänster) */}
      {mountedExerciseInfo && (
        <div style={{
          position: "absolute", top: 14, left: 14,
          background: "rgba(10,18,32,0.88)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14,
          padding: "14px 16px", pointerEvents: "all",
          minWidth: 200, maxWidth: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Välj övning
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {mountedExerciseInfo.exercises.map((ex) => {
              const active = ex.id === mountedExerciseInfo.exerciseId;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => mountedExerciseInfo.onChange(ex.id)}
                  style={{
                    background: active ? "rgba(59,130,246,0.85)" : "rgba(255,255,255,0.07)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 8, color: active ? "#fff" : "#cbd5e1",
                    fontSize: 12, fontWeight: active ? 700 : 400,
                    padding: "7px 12px", cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  {ex.label}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#475569", textAlign: "center" }}>
            E = Nästa övning · Space = Kliv ned
          </div>
          {difficulty === "manuell" && (
            <div style={{
              marginTop: 8, fontSize: 10, fontWeight: 600,
              color: "#22c55e", textAlign: "center",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 6, padding: "4px 6px",
            }}>
              💪 Manuell: {isTouch ? "dra joysticken upp/ner" : "W/S eller ↑/↓"} för att styra rörelsen
            </div>
          )}
        </div>
      )}

      {/* Kontroll-hint / proximity-prompt – nedre mitt */}
      <div style={{
        position: "absolute", bottom: isTouch ? 160 : 20, left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}>
        {/* Visa inte proximity-etiketten när gymnasten är monterad */}
        {!mountedExerciseInfo && nearEquipment ? (
          <div style={{
            background: "rgba(59,130,246,0.85)", backdropFilter: "blur(6px)",
            borderRadius: 20, padding: "7px 18px",
            color: "#fff", fontSize: 13, fontWeight: 600,
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}>
            {isTouch ? `👆 Hoppa upp på ${nearEquipment}` : `[Space] Hoppa upp på ${nearEquipment}`}
          </div>
        ) : (
          !isTouch && !mountedExerciseInfo && (
            <div style={{
              background: "rgba(10,18,32,0.55)", backdropFilter: "blur(4px)",
              borderRadius: 16, padding: "5px 14px",
              color: "rgba(255,255,255,0.7)", fontSize: 11,
            }}>
              WASD – Flytta &nbsp;·&nbsp; Space – Hoppa upp &nbsp;·&nbsp; F – Fri kamera
            </div>
          )
        )}
      </div>

      {/* Touch-kontroller */}
      {isTouch && (
        <>
          {/* Joystick – nedre vänster */}
          <div
            onPointerDown={onJoyDown}
            onPointerMove={onJoyMove}
            onPointerUp={onJoyUp}
            style={{
              position: "absolute", bottom: 40, left: 40,
              width: 100, height: 100,
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.25)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "all", touchAction: "none",
            }}
          >
            <div ref={joyKnobRef} style={{
              width: 44, height: 44,
              background: "rgba(255,255,255,0.45)",
              borderRadius: "50%",
              transition: "none",
            }} />
          </div>

          {/* Hoppa upp/av-knapp – nedre höger. I proffs-läge agerar den även
              som trick-knapp när ett fönster är öppet (kontextkänsligt label). */}
          <ActionButton
            mounted={!!mountedExerciseInfo}
            nearEquipment={nearEquipment}
            isProffs={isProffsMode(difficulty)}
            onPress={() => { mountTriggerRef.current = true; }}
          />
        </>
      )}

      {isProffsMode(difficulty) && <TrickOverlay />}
      {isProffsMode(difficulty) && <RoundTimer />}
      {isProffsMode(difficulty) && <RoundOverlay />}
      {isProffsMode(difficulty) && <Leaderboard />}
      {isProffsMode(difficulty) && <FailToast />}
      {isProffsMode(difficulty) && <ClearToast />}
      <GymnastStylePanel open={styleOpen} onClose={() => setStyleOpen(false)} />
      <InviteModal />
    </div>
  );
}

type ActionButtonProps = {
  mounted: boolean;
  nearEquipment: string | null;
  isProffs: boolean;
  onPress: () => void;
};

function ActionButton({ mounted, nearEquipment, isProffs, onPress }: ActionButtonProps) {
  const pending = useGameScore((s) => s.pendingTrick);
  const inWindow =
    isProffs && mounted && pending && Math.abs(pending.dt) * 1000 <= pending.windowMs;
  const label = inWindow
    ? pending.label.toUpperCase()
    : mounted
      ? "Hoppa\nav"
      : nearEquipment
        ? "Hoppa\nupp"
        : "Trick";
  const bg = inWindow
    ? "linear-gradient(135deg, rgba(245,158,11,0.95), rgba(234,88,12,0.95))"
    : mounted
      ? "rgba(239,68,68,0.85)"
      : nearEquipment
        ? "rgba(59,130,246,0.85)"
        : "rgba(34,197,94,0.85)";
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      style={{
        position: "absolute", bottom: 40, right: 40,
        width: 80, height: 80,
        background: bg,
        border: `2px solid ${inWindow ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.30)"}`,
        borderRadius: "50%",
        color: "#fff", fontSize: inWindow ? 12 : 11, fontWeight: 800,
        cursor: "pointer", pointerEvents: "all", touchAction: "none",
        transition: "background 0.15s, transform 0.1s",
        whiteSpace: "pre-line",
        lineHeight: 1.3,
        transform: inWindow ? "scale(1.08)" : "scale(1)",
        boxShadow: inWindow ? "0 0 24px rgba(245,158,11,0.7)" : "0 4px 14px rgba(0,0,0,0.35)",
      }}
    >
      {label}
    </button>
  );
}
