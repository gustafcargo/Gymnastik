/**
 * StartGameModal – välj åldersgrupp och dräktfärg innan spelläget startar.
 */
import { useState } from "react";
import { X, Gamepad2 } from "lucide-react";
import { usePlanStore, type AgeGroup } from "../../store/usePlanStore";

const LEOTARD_COLORS = [
  { color: "#C2185B", label: "Rosa" },
  { color: "#7C3AED", label: "Lila" },
  { color: "#1D4ED8", label: "Blå" },
  { color: "#059669", label: "Grön" },
  { color: "#D97706", label: "Orange" },
  { color: "#DC2626", label: "Röd" },
  { color: "#0891B2", label: "Turkos" },
  { color: "#DB2777", label: "Cerise" },
  { color: "#7C2D12", label: "Brun" },
  { color: "#374151", label: "Svart" },
];

const AGE_GROUPS: { id: AgeGroup; label: string; emoji: string; desc: string }[] = [
  { id: "5-8",   label: "5–8 år",   emoji: "⭐", desc: "Enkla uppdrag, stor firande!" },
  { id: "9-12",  label: "9–12 år",  emoji: "🏅", desc: "Blandade utmaningar" },
  { id: "13-16", label: "13–16 år", emoji: "🏆", desc: "Svårare mål, poängjakt" },
];

export function StartGameModal({ onClose }: { onClose: () => void }) {
  const setAgeGroup      = usePlanStore((s) => s.setAgeGroup);
  const setGymnasistColor = usePlanStore((s) => s.setGymnasistColor);
  const setGameMode       = usePlanStore((s) => s.setGameMode);
  const storedAge         = usePlanStore((s) => s.ageGroup);
  const storedColor       = usePlanStore((s) => s.gymnasistColor);

  const [selectedAge, setSelectedAge]     = useState<AgeGroup>(storedAge);
  const [selectedColor, setSelectedColor] = useState(storedColor);

  const handleStart = () => {
    setAgeGroup(selectedAge);
    setGymnasistColor(selectedColor);
    setGameMode(true);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 20,
        padding: "28px 32px", maxWidth: 440, width: "90%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        position: "relative",
      }}>
        {/* Stäng */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 14,
            background: "none", border: "none", cursor: "pointer",
            color: "#64748b", padding: 4,
          }}
        >
          <X size={18} />
        </button>

        {/* Rubrik */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40,
            background: "linear-gradient(135deg,#7c3aed,#db2777)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Gamepad2 size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Spelläge</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Välj åldersgrupp och dräktfärg</div>
          </div>
        </div>

        {/* Åldersgrupp */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: 10 }}>
            Åldersgrupp
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {AGE_GROUPS.map((ag) => {
              const active = selectedAge === ag.id;
              return (
                <button
                  key={ag.id}
                  type="button"
                  onClick={() => setSelectedAge(ag.id)}
                  style={{
                    flex: 1,
                    background: active ? "linear-gradient(135deg,#7c3aed,#db2777)" : "#f1f5f9",
                    border: `2px solid ${active ? "transparent" : "#e2e8f0"}`,
                    borderRadius: 12,
                    padding: "10px 6px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{ag.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#fff" : "#0f172a" }}>{ag.label}</span>
                  <span style={{ fontSize: 10, color: active ? "rgba(255,255,255,0.8)" : "#64748b", textAlign: "center", lineHeight: 1.3 }}>{ag.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dräktfärg */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: 10 }}>
            Dräktfärg
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LEOTARD_COLORS.map(({ color, label }) => (
              <button
                key={color}
                type="button"
                onClick={() => setSelectedColor(color)}
                title={label}
                style={{
                  width: 32, height: 32,
                  borderRadius: "50%",
                  background: color,
                  border: selectedColor === color ? "3px solid #0f172a" : "3px solid transparent",
                  boxShadow: selectedColor === color ? `0 0 0 2px ${color}66` : "none",
                  cursor: "pointer",
                  transition: "all 0.12s",
                  outline: "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Förhandsvisning + starta */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Liten gymnast-preview med vald färg */}
          <svg width={48} height={72} viewBox="0 0 48 72" style={{ flexShrink: 0 }}>
            {/* Huvud */}
            <circle cx={24} cy={8} r={7} fill="#E8C99A" />
            {/* Hår */}
            <ellipse cx={24} cy={5} rx={6} ry={4} fill="#2d1a08" />
            {/* Kropp */}
            <rect x={16} y={16} width={16} height={20} rx={5} fill={selectedColor} />
            {/* Vänster arm */}
            <rect x={8} y={18} width={7} height={14} rx={3.5} fill={selectedColor} />
            {/* Höger arm */}
            <rect x={33} y={18} width={7} height={14} rx={3.5} fill={selectedColor} />
            {/* Vänster ben */}
            <rect x={16} y={36} width={7} height={20} rx={3.5} fill={selectedColor} />
            {/* Höger ben */}
            <rect x={25} y={36} width={7} height={20} rx={3.5} fill={selectedColor} />
          </svg>
          <button
            type="button"
            onClick={handleStart}
            style={{
              flex: 1,
              background: "linear-gradient(135deg,#7c3aed,#db2777)",
              border: "none", borderRadius: 12,
              color: "#fff", fontSize: 15, fontWeight: 800,
              padding: "13px 0",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
              transition: "opacity 0.15s",
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            Starta spelläge 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
