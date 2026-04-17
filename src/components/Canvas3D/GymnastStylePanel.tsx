/**
 * GymnastStylePanel – enkel, barnvänlig stil-editor som öppnas från GameHUD.
 *
 * Designad för 5-12 åringar: inga fria hex-input, bara stora färg-rutor att
 * trycka på, presets för dräkt/hår/hud, samt en glitter-regel (0..1) som
 * slår på paljett-likt skimmer i leotard-materialet.
 *
 * Skriver direkt till `useGymnastTuning`-storen så både gymnast i spelet och
 * alla gymnaster i huvudvyn uppdateras live. Persistering sker via storens
 * `persist`-middleware.
 */
import { Sparkles, X, RotateCcw } from "lucide-react";
import { useGymnastTuning } from "../../store/useGymnastTuning";

type Props = {
  open: boolean;
  onClose: () => void;
};

// Förvalda färger per kategori. Samlade för att ge snabba, visuellt tydliga
// val åt yngre användare. Innehåller både neutralare och glada toner så barn
// kan blanda sig till en "stjärna"-dräkt.
const LEOTARD_COLORS = [
  "#9838c4", // lila
  "#c026d3", // magenta
  "#ec4899", // rosa
  "#ef4444", // röd
  "#f97316", // orange
  "#eab308", // gul
  "#22c55e", // grön
  "#06b6d4", // cyan
  "#3b82f6", // blå
  "#0f172a", // svart
  "#f8fafc", // vit
  "#fde047", // guld
];

const HAIR_COLORS = [
  "#2d1a08", // mörkbrun
  "#623a14", // brun (default)
  "#b4651e", // kastanj
  "#e0aa3e", // blond
  "#f4c77b", // ljusblond
  "#b91c1c", // rödbrun
  "#9ca3af", // grå
  "#ec4899", // rosa
  "#8b5cf6", // lila
  "#22d3ee", // turkos
];

const SKIN_COLORS = [
  "#fce7d2",
  "#f5d7a9",
  "#e6b583",
  "#c48968",
  "#8e5a3a",
  "#5c3924",
];

const RIBBON_COLORS = [
  "#ff6fa0", // rosa
  "#f43f5e", // röd
  "#fb923c", // orange
  "#fde047", // gul
  "#a3e635", // lime
  "#22d3ee", // turkos
  "#60a5fa", // blå
  "#c084fc", // lila
  "#f8fafc", // vit
];

function Swatch({
  color, selected, onClick,
}: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 42, height: 42, borderRadius: 12,
        background: color,
        border: selected ? "3px solid #facc15" : "2px solid rgba(255,255,255,0.35)",
        boxShadow: selected ? "0 0 12px rgba(250,204,21,0.6)" : "0 2px 6px rgba(0,0,0,0.3)",
        cursor: "pointer",
        padding: 0,
        transition: "transform 0.1s",
        transform: selected ? "scale(1.1)" : "scale(1)",
      }}
      aria-label={`Färg ${color}`}
    />
  );
}

function Section({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: "#e2e8f0",
        marginBottom: 6, letterSpacing: "0.04em",
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

export function GymnastStylePanel({ open, onClose }: Props) {
  const colors = useGymnastTuning((s) => s.colors);
  const sparkle = useGymnastTuning((s) => s.sparkle);
  const update = useGymnastTuning((s) => s.update);
  const reset = useGymnastTuning((s) => s.reset);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Stilpanel"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(8,12,24,0.72)",
        backdropFilter: "blur(6px)",
        zIndex: 120,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        pointerEvents: "all",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "20px 20px 0 0",
          padding: "20px 18px 28px",
          width: "100%", maxWidth: 460,
          maxHeight: "85vh", overflowY: "auto",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            color: "#facc15", fontSize: 18, fontWeight: 700,
          }}>
            <Sparkles size={20} /> Stylea gymnasten
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "grid", placeItems: "center",
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#f1f5f9", cursor: "pointer",
            }}
            aria-label="Stäng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Glitter-reglage – lyftes till toppen så den är lätt att hitta */}
        <div style={{
          background: "rgba(250,204,21,0.08)",
          border: "1px solid rgba(250,204,21,0.25)",
          borderRadius: 14, padding: 12, marginBottom: 16,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 6,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              color: "#facc15", fontSize: 13, fontWeight: 700,
            }}>
              <Sparkles size={14} /> Glitter
            </div>
            <span style={{ color: "#fde047", fontSize: 12, fontWeight: 600 }}>
              {Math.round(sparkle.amount * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={sparkle.amount}
            onChange={(e) => update("sparkle", { amount: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "#facc15", height: 6 }}
          />
        </div>

        <Section title="Dräkt">
          {LEOTARD_COLORS.map((c) => (
            <Swatch
              key={c}
              color={c}
              selected={colors.leotard.toLowerCase() === c.toLowerCase()}
              onClick={() => update("colors", { leotard: c })}
            />
          ))}
        </Section>

        <Section title="Hår">
          {HAIR_COLORS.map((c) => (
            <Swatch
              key={c}
              color={c}
              selected={colors.hair.toLowerCase() === c.toLowerCase()}
              onClick={() => update("colors", { hair: c })}
            />
          ))}
        </Section>

        <Section title="Hud">
          {SKIN_COLORS.map((c) => (
            <Swatch
              key={c}
              color={c}
              selected={colors.skin.toLowerCase() === c.toLowerCase()}
              onClick={() => update("colors", { skin: c })}
            />
          ))}
        </Section>

        <Section title="Hårband / rosett">
          {RIBBON_COLORS.map((c) => (
            <Swatch
              key={c}
              color={c}
              selected={colors.ribbon.toLowerCase() === c.toLowerCase()}
              onClick={() => update("colors", { ribbon: c })}
            />
          ))}
        </Section>

        <button
          type="button"
          onClick={() => {
            if (confirm("Återställ gymnastens utseende till standard?")) reset();
          }}
          style={{
            marginTop: 8, width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, padding: "10px",
            color: "#cbd5e1", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={14} /> Återställ utseende
        </button>
      </div>
    </div>
  );
}
