/**
 * GameMenu – samlar alla HUD-inställningar (kamera, hastighet, stil, ljud,
 * svårighet, tävlingsläge, runda-start) under en enda kugge-knapp uppe i
 * högra hörnet. Tidigare var det 5–7 lösa knappar staplade där, vilket
 * gjorde spelläges-HUD:en stökig och täckte över scenen på iPhone.
 *
 * Avsluta-knappen ligger kvar separat (alltid åtkomlig); allt annat
 * flyttas in i en dropdown-panel som öppnas vid tryck på kugghjulet och
 * stängs vid klick utanför eller Escape.
 */
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Dumbbell,
  Gamepad2,
  Play,
  Settings2,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAudioStore } from "../../store/useAudioStore";
import { useGameConfig, isProffsMode } from "../../store/useGameConfig";
import { useGameMode } from "../../store/useGameMode";
import { useGameScore } from "../../store/useGameScore";

type Props = {
  speedRef: React.MutableRefObject<number>;
  cameraResetRef: React.MutableRefObject<boolean>;
  freeCamActive: boolean;
  onOpenStyle: () => void;
};

const CARD_BG = "rgba(10,18,32,0.88)";
const CARD_BORDER = "1px solid rgba(255,255,255,0.15)";

export function GameMenu({
  speedRef,
  cameraResetRef,
  freeCamActive,
  onOpenStyle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [speedDisplay, setSpeedDisplay] = useState(speedRef.current);
  const ref = useRef<HTMLDivElement>(null);

  const muted = useAudioStore((s) => s.muted);
  const toggleMute = useAudioStore((s) => s.toggle);

  const difficulty = useGameConfig((s) => s.difficulty);
  const toggleDifficulty = useGameConfig((s) => s.toggleDifficulty);

  const gameMode = useGameMode((s) => s.gameMode);
  const roundState = useGameMode((s) => s.roundState);
  const lifetimeBest = useGameScore((s) => s.lifetimeBestTavling);

  // Stäng menyn vid klick utanför eller Escape, så spelaren kommer tillbaka
  // till ett rent HUD snabbt.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 52,
        right: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        pointerEvents: "all",
        zIndex: 220,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-expanded={open}
        aria-label={open ? "Stäng meny" : "Öppna meny"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: CARD_BG,
          backdropFilter: "blur(6px)",
          border: CARD_BORDER,
          borderRadius: 8,
          color: "#f1f5f9",
          fontSize: 12,
          fontWeight: 600,
          padding: "6px 12px",
          cursor: "pointer",
          touchAction: "manipulation",
        }}
      >
        <Settings2 size={14} /> Meny
      </button>

      {freeCamActive && (
        <div
          style={{
            background: "rgba(59,130,246,0.85)",
            borderRadius: 8,
            padding: "3px 10px",
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Fri kamera (F)
        </div>
      )}

      {open && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 220,
            background: CARD_BG,
            backdropFilter: "blur(8px)",
            border: CARD_BORDER,
            borderRadius: 12,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            color: "#f1f5f9",
          }}
        >
          <MenuButton
            onClick={() => {
              cameraResetRef.current = true;
              setOpen(false);
            }}
            icon={<Camera size={13} />}
            label="Återställ kamera"
          />

          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "6px 10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#94a3b8",
                fontWeight: 600,
                marginBottom: 3,
              }}
            >
              <span>Hastighet</span>
              <span>{speedDisplay.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              min={1.5}
              max={5}
              step={0.1}
              value={speedDisplay}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSpeedDisplay(v);
                speedRef.current = v;
              }}
              style={{ width: "100%", accentColor: "#3B82F6", height: 4 }}
            />
          </div>

          <MenuButton
            onClick={() => {
              onOpenStyle();
              setOpen(false);
            }}
            icon={<Sparkles size={13} />}
            label="Stil"
            bg="linear-gradient(135deg, rgba(236,72,153,0.85), rgba(168,85,247,0.85))"
            bold
          />

          <MenuButton
            onClick={toggleMute}
            icon={muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            label={muted ? "Ljud av" : "Ljud på"}
            bg={muted ? "rgba(100,116,139,0.6)" : "rgba(255,255,255,0.06)"}
          />

          <MenuButton
            onClick={() => {
              toggleDifficulty();
              try {
                localStorage.setItem("gymnast-difficulty-hint-seen", "1");
              } catch {
                /* ignore */
              }
            }}
            icon={
              difficulty === "proffs" ? (
                <Trophy size={13} />
              ) : difficulty === "manuell" ? (
                <Dumbbell size={13} />
              ) : (
                <Gamepad2 size={13} />
              )
            }
            label={`Svårighet: ${
              difficulty === "proffs"
                ? "Proffs"
                : difficulty === "manuell"
                  ? "Manuell"
                  : "Auto"
            }`}
            bg={
              difficulty === "proffs"
                ? "linear-gradient(135deg, rgba(245,158,11,0.92), rgba(234,88,12,0.92))"
                : difficulty === "manuell"
                  ? "linear-gradient(135deg, rgba(34,197,94,0.88), rgba(16,185,129,0.88))"
                  : "rgba(255,255,255,0.06)"
            }
            bold={difficulty !== "auto"}
          />

          {isProffsMode(difficulty) && (
            <>
              <MenuButton
                onClick={() => useGameMode.getState().toggleGameMode()}
                icon={<Timer size={13} />}
                label={gameMode === "tavling" ? "Tävlingsläge" : "Fritt läge"}
                bg={
                  gameMode === "tavling"
                    ? "linear-gradient(135deg, rgba(239,68,68,0.92), rgba(185,28,28,0.92))"
                    : "rgba(255,255,255,0.06)"
                }
                bold={gameMode === "tavling"}
              />

              {gameMode === "tavling" && roundState === "idle" && (
                <MenuButton
                  onClick={() => {
                    useGameScore.getState().resetScore();
                    useGameMode.getState().startCountdown();
                    setOpen(false);
                  }}
                  icon={<Play size={13} />}
                  label="Starta runda"
                  bg="linear-gradient(135deg, #22c55e, #16a34a)"
                  bold
                />
              )}

              {gameMode === "tavling" &&
                lifetimeBest > 0 &&
                roundState === "idle" && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      fontWeight: 600,
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      textAlign: "center",
                    }}
                  >
                    Personligt rekord:{" "}
                    <span style={{ color: "#f59e0b", fontWeight: 800 }}>
                      {lifetimeBest.toLocaleString("sv-SE")}
                    </span>
                  </div>
                )}
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              cursor: "pointer",
              marginTop: 2,
            }}
          >
            <X size={12} /> Stäng
          </button>
        </div>
      )}
    </div>
  );
}

function MenuButton({
  onClick,
  icon,
  label,
  bg = "rgba(255,255,255,0.06)",
  bold = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  bg?: string;
  bold?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: bg,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        color: "#f1f5f9",
        fontSize: 12,
        fontWeight: bold ? 700 : 600,
        padding: "7px 10px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}
