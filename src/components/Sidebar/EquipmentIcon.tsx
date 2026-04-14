import type { EquipmentType } from "../../types";

type Props = {
  type: EquipmentType;
  size?: number;
};

/**
 * Miniatyr-SVG av ett redskap – matchar canvasens detaljer i miniatyr.
 */
export function EquipmentIcon({ type, size = 48 }: Props) {
  const aspect = type.widthM / type.heightM;
  let w = size;
  let h = size;
  if (aspect > 1) {
    h = size / aspect;
  } else {
    w = size * aspect;
  }
  w = Math.max(18, w);
  h = Math.max(18, h);

  const rx = type.shape === "ellipse" ? w / 2 : 4;
  const ry = type.shape === "ellipse" ? h / 2 : 4;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="drop-shadow-sm"
    >
      {type.shape === "ellipse" ? (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2 - 1}
          ry={h / 2 - 1}
          fill={type.color}
          stroke="#334155"
          strokeWidth={1.1}
        />
      ) : (
        <rect
          x={1}
          y={1}
          width={w - 2}
          height={h - 2}
          rx={rx}
          ry={ry}
          fill={type.color}
          stroke="#334155"
          strokeWidth={1.1}
        />
      )}
      {renderDetail(type, w, h)}
    </svg>
  );
}

function renderDetail(type: EquipmentType, w: number, h: number) {
  const detail = type.detail;
  if (!detail) return null;
  const stroke = "#3F2C1A";
  switch (detail.kind) {
    case "parallel-bars":
      return (
        <g stroke={stroke} strokeWidth={1.4} strokeLinecap="round">
          <line x1={w * 0.08} y1={h * 0.3} x2={w * 0.92} y2={h * 0.3} />
          <line x1={w * 0.08} y1={h * 0.7} x2={w * 0.92} y2={h * 0.7} />
        </g>
      );
    case "high-bar":
      return (
        <line
          x1={w * 0.06}
          y1={h * 0.5}
          x2={w * 0.94}
          y2={h * 0.5}
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      );
    case "beam":
      return (
        <rect
          x={w * 0.05}
          y={h * 0.38}
          width={w * 0.9}
          height={h * 0.24}
          fill="#F1D9A5"
          stroke={stroke}
          strokeWidth={1}
          rx={h * 0.1}
        />
      );
    case "pommel-horse":
      return (
        <g stroke={stroke} strokeWidth={1.1} fill="none" strokeLinejoin="round">
          <path d={`M ${w * 0.32} ${h * 0.2} V ${h * 0.5} H ${w * 0.42} V ${h * 0.2}`} />
          <path d={`M ${w * 0.58} ${h * 0.2} V ${h * 0.5} H ${w * 0.68} V ${h * 0.2}`} />
        </g>
      );
    case "rings": {
      const r = Math.min(w, h) * 0.28;
      return (
        <g stroke={stroke} strokeWidth={1.2} fill="none">
          <circle cx={w * 0.35} cy={h * 0.55} r={r} />
          <circle cx={w * 0.65} cy={h * 0.55} r={r} />
        </g>
      );
    }
    case "vault":
      return (
        <rect
          x={w * 0.1}
          y={h * 0.28}
          width={w * 0.8}
          height={h * 0.44}
          fill="rgba(255,255,255,0.4)"
          stroke={stroke}
          strokeWidth={0.9}
          rx={h * 0.2}
        />
      );
    case "trampette":
    case "mini-tramp": {
      const lines = [];
      for (let i = 1; i < 6; i++) {
        const x = (i * w) / 6;
        lines.push(
          <line
            key={i}
            x1={x}
            y1={h * 0.18}
            x2={x}
            y2={h * 0.82}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={0.8}
          />,
        );
      }
      return <g>{lines}</g>;
    }
    case "floor":
      return (
        <rect
          x={w * 0.08}
          y={h * 0.08}
          width={w * 0.84}
          height={h * 0.84}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeDasharray="4 3"
          strokeWidth={0.8}
        />
      );
    case "tumbling-track":
    case "air-track":
      return (
        <line
          x1={w * 0.05}
          y1={h * 0.5}
          x2={w * 0.95}
          y2={h * 0.5}
          stroke="rgba(0,0,0,0.35)"
          strokeDasharray="3 3"
          strokeWidth={0.8}
        />
      );
    case "thick-mat":
    case "landing-mat":
      return (
        <g stroke="rgba(0,0,0,0.35)" strokeWidth={0.8}>
          <line x1={w * 0.1} y1={h * 0.3} x2={w * 0.9} y2={h * 0.3} />
          <line x1={w * 0.1} y1={h * 0.5} x2={w * 0.9} y2={h * 0.5} />
          <line x1={w * 0.1} y1={h * 0.7} x2={w * 0.9} y2={h * 0.7} />
        </g>
      );
    case "plinth":
    case "buck":
      return (
        <g stroke="rgba(0,0,0,0.35)" strokeWidth={0.8}>
          <line x1={w * 0.05} y1={h * 0.35} x2={w * 0.95} y2={h * 0.35} />
          <line x1={w * 0.05} y1={h * 0.65} x2={w * 0.95} y2={h * 0.65} />
        </g>
      );
    case "foam-pit":
      return (
        <g fill="rgba(255,255,255,0.55)">
          {Array.from({ length: 6 }).map((_, i) => (
            <circle
              key={i}
              cx={(i % 3) * (w / 3) + w / 6}
              cy={Math.floor(i / 3) * (h / 2) + h / 4}
              r={Math.min(w, h) * 0.09}
            />
          ))}
        </g>
      );
    default:
      return null;
  }
}
