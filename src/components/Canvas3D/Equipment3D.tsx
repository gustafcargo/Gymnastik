import { useMemo } from "react";
import * as THREE from "three";
import type { EquipmentType } from "../../types";

type Props = {
  type: EquipmentType;
  color?: string;
  partColors?: Record<string, string>;
  params?: Record<string, number>;
};

/** Returns a quaternion that aligns a cylinder's Y-axis with the given direction. */
function alignY(dx: number, dy: number, dz: number): THREE.Quaternion {
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}

/** Look up a part color: partColors override, then default. */
function pc(
  partColors: Record<string, string> | undefined,
  key: string,
  fallback: string,
): string {
  return partColors?.[key] ?? fallback;
}

export function Equipment3D({ type, color, partColors, params }: Props) {
  switch (type.detail?.kind) {
    case "parallel-bars":
      return <ParallelBars w={type.widthM} d={type.heightM} color={color} partColors={partColors} params={params} />;
    case "high-bar":
      return <HighBar w={type.widthM} d={type.heightM} color={color} partColors={partColors} params={params} />;
    case "beam":
      return <Beam w={type.widthM} color={color} partColors={partColors} params={params} />;
    case "pommel-horse":
      return <PommelHorse w={type.widthM} color={color} partColors={partColors} params={params} />;
    case "rings":
      return <Rings w={type.widthM} d={type.heightM} h={type.physicalHeightM} partColors={partColors} params={params} />;
    case "uneven-bars":
      return <UnevenBars w={type.widthM} d={type.heightM} partColors={partColors} params={params} />;
    case "vault":
      return <Vault w={type.widthM} d={type.heightM} color={color} partColors={partColors} params={params} />;
    case "trampette":
    case "mini-tramp":
      return <Trampette w={type.widthM} d={type.heightM} color={color} partColors={partColors} />;
    case "tumbling-track":
      return <Track w={type.widthM} d={type.heightM} h={params?.trackH ?? type.physicalHeightM} color={color} />;
    case "air-track":
      return <AirTrack w={type.widthM} d={type.heightM} h={params?.trackH ?? type.physicalHeightM} color={color} />;
    case "floor":
      return <Floor w={type.widthM} d={type.heightM} color={color} />;
    case "thick-mat":
      return <Mat w={type.widthM} d={type.heightM} h={params?.matH ?? type.physicalHeightM} color={color ?? "#2A60A0"} />;
    case "landing-mat":
      return <Mat w={type.widthM} d={type.heightM} h={params?.matH ?? type.physicalHeightM} color={color ?? "#CC7020"} />;
    case "plinth":
      return <Plinth w={type.widthM} d={type.heightM} h={type.physicalHeightM} color={color} params={params} />;
    case "buck":
      return <Buck w={type.widthM} h={type.physicalHeightM} color={color} partColors={partColors} params={params} />;
    case "foam-pit":
      return <FoamPit w={type.widthM} d={type.heightM} color={color} />;
    default: {
      // Render custom parts if defined, otherwise fall back to a single box.
      const parts = type.customParts;
      if (parts && parts.length > 0) {
        return (
          <>
            {parts.map((p) => (
              <group
                key={p.id}
                position={[p.offsetX, p.offsetY + p.h / 2, p.offsetZ]}
                rotation={[0, ((p.rotationY ?? 0) * Math.PI) / 180, 0]}
              >
                <mesh castShadow receiveShadow>
                  {p.shape === "cylinder" ? (
                    <cylinderGeometry args={[p.w / 2, p.w / 2, p.h, 24]} />
                  ) : p.shape === "sphere" ? (
                    <sphereGeometry args={[p.w / 2, 24, 16]} />
                  ) : p.shape === "cone" ? (
                    <coneGeometry args={[p.w / 2, p.h, 24]} />
                  ) : p.shape === "torus" ? (
                    <torusGeometry args={[p.w / 2, Math.max(0.01, p.d / 4), 16, 48]} />
                  ) : p.shape === "wedge" ? (
                    <WedgeGeom w={p.w} h={p.h} d={p.d} />
                  ) : (
                    <boxGeometry args={[p.w, p.h, p.d]} />
                  )}
                  <meshPhysicalMaterial color={p.color ?? color ?? type.color} roughness={0.45} metalness={0.05} />
                </mesh>
              </group>
            ))}
          </>
        );
      }
      return (
        <mesh position={[0, type.physicalHeightM / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[type.widthM, Math.max(0.1, type.physicalHeightM), type.heightM]} />
          <meshPhysicalMaterial color={color ?? type.color} roughness={0.7} metalness={0} />
        </mesh>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Barr (Parallel bars) – FIG: 2.4 m bars, 1.75 m height, 42–52 cm spacing
// ---------------------------------------------------------------------------

function ParallelBars({
  w, color, partColors, params,
}: { w: number; d: number; color?: string; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const railH1 = params?.railH1 ?? 1.75;
  const railH2 = params?.railH2 ?? 1.75;
  const railSpacing = params?.railSpacing ?? 0.42;
  const railR = 0.022;
  const postR = 0.038;
  const baseH = 0.04;
  // Bar length: w ≈ 3.2m (footprint includes end overhang); actual bar = ~2.4 m
  const barLen = Math.min(w * 0.76, 2.4);
  const railColor = pc(partColors, "räcken", color ?? "#B8824A");
  const frameColor = pc(partColors, "ram", "#CDD2DA");

  const postXs = [-barLen / 2 + 0.06, barLen / 2 - 0.06] as number[];

  return (
    <group>
      {/* Base plates for each side */}
      {([-railSpacing / 2, railSpacing / 2] as number[]).map((z, si) => (
        postXs.map((x, pi) => (
          <mesh key={`base-${si}-${pi}`} position={[x, baseH / 2, z]} receiveShadow castShadow>
            <boxGeometry args={[0.35, baseH, 0.42]} />
            <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
          </mesh>
        ))
      )).flat()}
      {/* Posts (4 total – 2 per bar) */}
      {([
        { z: -railSpacing / 2, h: railH1 },
        { z:  railSpacing / 2, h: railH2 },
      ] as { z: number; h: number }[]).flatMap(({ z, h }) =>
        postXs.map((x, i) => (
          <mesh key={`post-${z}-${i}`} position={[x, h / 2 + baseH, z]} castShadow>
            <cylinderGeometry args={[postR, postR * 1.12, h, 14]} />
            <meshPhysicalMaterial color={frameColor} roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
          </mesh>
        ))
      )}
      {/* Connecting braces between the two posts of each bar */}
      {([-railSpacing / 2, railSpacing / 2] as number[]).map((z, si) => (
        <mesh key={`brace-${si}`} position={[0, 0.32, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.016, 0.016, barLen - 0.2, 8]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.15} metalness={0.95} />
        </mesh>
      ))}
      {/* Rails */}
      {[
        { z: -railSpacing / 2, h: railH1 + baseH },
        { z:  railSpacing / 2, h: railH2 + baseH },
      ].map(({ z, h }, i) => (
        <mesh key={`rail-${i}`} position={[0, h, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[railR, barLen - railR * 2, 6, 18]} />
          <meshPhysicalMaterial color={railColor} roughness={0.3} metalness={0.05} clearcoat={0.5} clearcoatRoughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Räck (High bar) – FIG: 2.40 m bar, ø28 mm, 2.75 m height, 4 cable stays
// ---------------------------------------------------------------------------

function HighBar({
  w, d, color, partColors, params,
}: { w: number; d: number; color?: string; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const barH    = params?.barH ?? 2.75;
  const barR    = 0.014;   // 28 mm diameter
  const barLen  = 2.40;    // FIG fixed bar length
  const postR   = 0.044;
  const baseH   = 0.04;
  // Posts sit at ~1/3 of bar length from each end → ±0.80 m from centre
  const xPost   = Math.min(w * 0.44, 0.88);
  // Cable floor anchors fill most of the allocated footprint
  const cableX  = w / 2 - 0.06;
  const cableZ  = d / 2 - 0.06;

  const barColor  = pc(partColors, "stång",   color ?? "#CDD2DA");
  const postColor = pc(partColors, "stommar", "#CDD2DA");
  const wireColor = pc(partColors, "vajrar",  "#A8B0BA");

  return (
    <group>
      {/* Two separate base plates (one per upright) */}
      {([-xPost, xPost] as number[]).map((x, i) => (
        <mesh key={`base-${i}`} position={[x, baseH / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.45, baseH, Math.min(d * 0.80, 1.10)]} />
          <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
        </mesh>
      ))}

      {/* Uprights */}
      {([-xPost, xPost] as number[]).map((x, i) => (
        <group key={`up-${i}`}>
          <mesh position={[x, barH / 2 + baseH, 0]} castShadow>
            <cylinderGeometry args={[postR, postR * 1.14, barH, 16]} />
            <meshPhysicalMaterial color={postColor} roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
          </mesh>
          {/* Top mount bracket */}
          <mesh position={[x, barH + baseH, 0]} castShadow>
            <boxGeometry args={[0.08, 0.055, 0.055]} />
            <meshPhysicalMaterial color="#404858" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* 4 cable stays */}
      {([-1, 1] as number[]).flatMap((sx) =>
        ([-1, 1] as number[]).map((sz) => {
          const from: [number, number, number] = [xPost * sx, barH + baseH, 0];
          const to:   [number, number, number] = [cableX * sx, baseH, cableZ * sz];
          const dx = to[0]-from[0], dy = to[1]-from[1], dz = to[2]-from[2];
          const len = Math.hypot(dx, dy, dz);
          const mid: [number, number, number] = [(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2];
          return (
            <mesh key={`c-${sx}-${sz}`} position={mid} quaternion={alignY(dx, dy, dz)} castShadow>
              <cylinderGeometry args={[0.006, 0.006, len, 6]} />
              <meshPhysicalMaterial color={wireColor} roughness={0.35} metalness={0.90} />
            </mesh>
          );
        }),
      )}

      {/* Bar – 2.40 m, ø28 mm */}
      <mesh position={[0, barH + baseH, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[barR, barLen - barR * 2, 6, 18]} />
        <meshPhysicalMaterial
          color={barColor}
          roughness={color || partColors?.["stång"] ? 0.40 : 0.06}
          metalness={color || partColors?.["stång"] ? 0.00 : 1.00}
          clearcoat={0.75}
          clearcoatRoughness={0.05}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bom (Balance beam) – FIG: 5 m × 10 cm surface at 1.25 m
// ---------------------------------------------------------------------------

function Beam({
  w, color, partColors, params,
}: { w: number; color?: string; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const beamH     = params?.beamH    ?? 1.25;  // top surface from floor
  const beamWidth = params?.beamWidth ?? 0.10;
  const bodyH     = 0.08;   // structural aluminium body
  const topH      = 0.05;   // leather/suede pad

  // Geometry Y positions (all absolute from floor)
  const topCenter  = beamH - topH / 2;
  const bodyCenter = beamH - topH - bodyH / 2;
  const pedestalH  = beamH - topH - bodyH;   // floor → underside of body ≈ 1.11 m

  const postColor  = pc(partColors, "stöd", color ?? "#C82020");
  const bodyColor  = pc(partColors, "bom",  "#4A2810");
  const topColor   = pc(partColors, "yta",  "#B8875A");

  const postXs = [-w * 0.36, w * 0.36] as number[];

  return (
    <group>
      {postXs.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {/* Floor base plate */}
          <mesh position={[0, 0.022, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.58, 0.044, 0.60]} />
            <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
          </mesh>
          {/* Outer fixed post – slim round tube */}
          <mesh position={[0, pedestalH * 0.50, 0]} castShadow>
            <cylinderGeometry args={[0.034, 0.038, pedestalH, 16]} />
            <meshPhysicalMaterial color={postColor} roughness={0.10} metalness={0.95} clearcoat={0.55} clearcoatRoughness={0.10} />
          </mesh>
          {/* Inner telescoping section (narrower, top 40 %) */}
          <mesh position={[0, pedestalH * 0.78, 0]} castShadow>
            <cylinderGeometry args={[0.026, 0.030, pedestalH * 0.44, 16]} />
            <meshPhysicalMaterial color={postColor} roughness={0.08} metalness={0.98} clearcoat={0.6} clearcoatRoughness={0.08} />
          </mesh>
          {/* Top bracket / spring cap */}
          <mesh position={[0, pedestalH + 0.025, 0]} castShadow>
            <boxGeometry args={[0.16, 0.05, 0.16]} />
            <meshPhysicalMaterial color="#3A4455" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Beam structural body (aluminium) */}
      <mesh position={[0, bodyCenter, 0]} castShadow>
        <boxGeometry args={[w, bodyH, beamWidth * 1.15]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.55} metalness={0.0} />
      </mesh>
      {/* Leather / suede top pad */}
      <mesh position={[0, topCenter, 0]} castShadow>
        <boxGeometry args={[w - 0.02, topH, beamWidth]} />
        <meshPhysicalMaterial color={topColor} roughness={0.94} metalness={0.0} />
      </mesh>
      {/* Rounded end profiles */}
      {([-w / 2 + 0.035, w / 2 - 0.035] as number[]).map((x, i) => (
        <mesh key={i} position={[x, topCenter, 0]} castShadow>
          <cylinderGeometry args={[beamWidth * 0.46, beamWidth * 0.50, topH, 14]} />
          <meshPhysicalMaterial color={topColor} roughness={0.92} metalness={0.0} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bygelhäst (Pommel horse) – FIG: 1.60 × 35 cm body, 115 cm total height,
//   pommels 12 cm above surface, 40–45 cm centre-to-centre
// ---------------------------------------------------------------------------

function PommelHorse({
  color, partColors, params,
}: { w: number; color?: string; partColors?: Record<string, string>; params?: Record<string, number> }) {
  // standH = floor → top of saddle surface
  const standH  = params?.standH ?? 0.87;   // legs + body = 1.15 m total
  const handleSpacing = params?.handleSpacing ?? 0.42;
  const bodyLen  = 1.60;   // FIG fixed
  const bodyW    = 0.35;
  const bodyH    = 0.28;   // FIG body height
  const riseH    = 0.12;   // pommels 12 cm above surface
  const stemR    = 0.018;  // pommel tube radius
  const arcR     = 0.072;  // U-arc inner radius

  const bodyColor   = pc(partColors, "kropp",  color ?? "#7A5230");
  const topColor    = pc(partColors, "yta",    "#A07848");
  const pommelColor = pc(partColors, "byglar", "#CDD2DA");
  const legColor    = pc(partColors, "ben",    "#CDD2DA");

  const legXs = [-bodyLen * 0.38, bodyLen * 0.38] as number[];
  const legZs = [-bodyW  * 0.40, bodyW  * 0.40] as number[];
  const legH  = standH - bodyH;

  return (
    <group>
      {/* Four legs with base spreaders */}
      {legXs.flatMap((x) => legZs.map((z, i) => (
        <group key={`${x}-${i}`}>
          <mesh position={[x, 0.018, z]} receiveShadow castShadow>
            <boxGeometry args={[0.24, 0.036, 0.30]} />
            <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
          </mesh>
          <mesh position={[x, legH / 2, z]} castShadow>
            <cylinderGeometry args={[0.022, 0.028, legH, 14]} />
            <meshPhysicalMaterial color={legColor} roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
          </mesh>
        </group>
      )))}

      {/* Saddle body – tapered prismoid */}
      <mesh position={[0, legH + bodyH / 2, 0]} castShadow>
        <boxGeometry args={[bodyLen, bodyH, bodyW]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.72} metalness={0.0} />
      </mesh>
      {/* Leather top surface */}
      <mesh position={[0, standH + 0.005, 0]} castShadow>
        <boxGeometry args={[bodyLen - 0.04, 0.01, bodyW - 0.02]} />
        <meshPhysicalMaterial color={topColor} roughness={0.88} metalness={0.0} />
      </mesh>

      {/* Pommels – U-shaped: two stems + connecting arc */}
      {([-handleSpacing / 2, handleSpacing / 2] as number[]).map((px, pi) => (
        <group key={pi} position={[px, standH, 0]}>
          {/* Left stem */}
          <mesh position={[0, riseH / 2, -arcR]} castShadow>
            <cylinderGeometry args={[stemR, stemR, riseH, 10]} />
            <meshPhysicalMaterial color={pommelColor} roughness={0.08} metalness={1.0} clearcoat={0.7} clearcoatRoughness={0.06} />
          </mesh>
          {/* Right stem */}
          <mesh position={[0, riseH / 2, arcR]} castShadow>
            <cylinderGeometry args={[stemR, stemR, riseH, 10]} />
            <meshPhysicalMaterial color={pommelColor} roughness={0.08} metalness={1.0} clearcoat={0.7} clearcoatRoughness={0.06} />
          </mesh>
          {/* Arc connecting stems in the ZY-plane: rotate torus so arc sweeps from +Z over +Y to -Z */}
          <mesh position={[0, riseH, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
            <torusGeometry args={[arcR, stemR, 10, 22, Math.PI]} />
            <meshPhysicalMaterial color={pommelColor} roughness={0.08} metalness={1.0} clearcoat={0.7} clearcoatRoughness={0.06} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ringar (Rings) – standalone frame with competition-style A-posts + cables
// ---------------------------------------------------------------------------

function Rings({
  w, h, partColors, params,
}: { w: number; d: number; h: number; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const ringH = params?.ringH ?? h;
  // Competition frame: 6.05 m tall; training standalone ≈ ringH + 2.8 m
  const frameH = Math.max(ringH + 2.8, 5.5);
  const ringR = 0.09;          // 18 cm inner diameter → 9 cm inner radius
  const ringT = 0.014;         // 2.8 cm profile → ~1.4 cm radius
  const ringSpacing = 0.25;    // 50 cm center-to-center → ±25 cm
  const strapH = Math.max(0.1, ringH - 0.2);
  const ringY = Math.max(0.1, ringH - 0.09);
  const xPost = 0.34;
  const postR = 0.036;

  const ringColor = pc(partColors, "ringar", "#CDD2DA");
  const strapColor = pc(partColors, "remmar", "#6B4A2A");
  const frameColor = pc(partColors, "ram", "#8B3030");

  // Helper: axis-aligned cable from (x1,y1,z1) to (x2,y2,z2)
  const cable = (key: string, from: [number,number,number], to: [number,number,number]) => {
    const dx = to[0]-from[0], dy = to[1]-from[1], dz = to[2]-from[2];
    const len = Math.hypot(dx, dy, dz);
    const mid: [number,number,number] = [(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2];
    return (
      <mesh key={key} position={mid} quaternion={alignY(dx, dy, dz)} castShadow>
        <cylinderGeometry args={[0.006, 0.006, len, 4]} />
        <meshPhysicalMaterial color="#607880" roughness={0.4} metalness={0.88} />
      </mesh>
    );
  };

  return (
    <group>
      {/* Floor base cross piece */}
      <mesh position={[0, 0.025, 0]} receiveShadow castShadow>
        <boxGeometry args={[xPost * 2 + 0.3, 0.05, 0.55]} />
        <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
      </mesh>

      {/* Two vertical posts */}
      {([-xPost, xPost] as number[]).map((x, i) => (
        <mesh key={i} position={[x, frameH / 2, 0]} castShadow>
          <cylinderGeometry args={[postR, postR * 1.15, frameH, 14]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.25} metalness={0.75} clearcoat={0.4} />
        </mesh>
      ))}

      {/* Top crossbeam */}
      <mesh position={[0, frameH, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.022, xPost * 2 - 0.04, 6, 12]} />
        <meshPhysicalMaterial color={frameColor} roughness={0.25} metalness={0.75} clearcoat={0.4} />
      </mesh>

      {/* Small suspension block at crossbeam center */}
      <mesh position={[0, frameH - 0.08, 0]} castShadow>
        <boxGeometry args={[0.12, 0.06, 0.06]} />
        <meshPhysicalMaterial color="#444" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Cable stays: from each post top to 4 floor anchors */}
      {([-xPost, xPost] as number[]).flatMap((x) => [
        cable(`c1-${x}`, [x, frameH, 0], [x * 2.0, 0, -w * 0.45]),
        cable(`c2-${x}`, [x, frameH, 0], [x * 2.0, 0,  w * 0.45]),
      ])}

      {/* Two rings with straps hanging from crossbeam center */}
      {([-ringSpacing, ringSpacing] as number[]).map((dx, i) => (
        <group key={i} position={[dx, 0, 0]}>
          {/* Suspension cable from beam to strap top */}
          <mesh position={[0, frameH - strapH / 2 - ringR - 0.1, 0]} castShadow>
            <boxGeometry args={[0.008, frameH - ringH - 0.1, 0.008]} />
            <meshPhysicalMaterial color={strapColor} roughness={0.7} metalness={0} />
          </mesh>
          {/* Leather strap */}
          <mesh position={[0, ringY + strapH / 2 + ringR, 0]} castShadow>
            <boxGeometry args={[0.030, strapH, 0.014]} />
            <meshPhysicalMaterial color={strapColor} roughness={0.75} metalness={0} />
          </mesh>
          {/* Ring */}
          <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[ringR, ringT, 16, 36]} />
            <meshPhysicalMaterial color={ringColor} roughness={0.08} metalness={1.0} clearcoat={0.7} clearcoatRoughness={0.06} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Hoppbord (Vault table) – modern FIG vault table (95×120 cm, 135 cm tall)
// ---------------------------------------------------------------------------

function Vault({
  w, d, color, partColors, params,
}: { w: number; d: number; color?: string; partColors?: Record<string, string>; params?: Record<string, number> }) {
  // w=0.95m (width), d=1.2m (depth/run-up axis), total height = standH + padH
  const standH = params?.standH ?? 1.12;   // pedestal height
  const padH = params?.padH ?? 0.22;        // top pad thickness
  const totalH = standH + padH;
  const bodyColor = pc(partColors, "kropp", color ?? "#4A2810");
  const topColor = pc(partColors, "yta", "#C8A878");
  const baseColor = "#252D3A";

  return (
    <group>
      {/* Base frame – four legs */}
      {([[-w * 0.34, -d * 0.38], [w * 0.34, -d * 0.38], [-w * 0.34, d * 0.38], [w * 0.34, d * 0.38]] as [number,number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, standH * 0.22, z]} castShadow receiveShadow>
          <cylinderGeometry args={[0.028, 0.034, standH * 0.44, 10]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.25} metalness={0.9} />
        </mesh>
      ))}
      {/* Horizontal base cross-members */}
      {([0, Math.PI / 2] as number[]).map((ry, i) => (
        <mesh key={i} position={[0, 0.025, 0]} rotation={[0, ry, 0]} receiveShadow>
          <boxGeometry args={[w * 0.75, 0.04, 0.045]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.4} metalness={0.85} />
        </mesh>
      ))}
      {/* Upper cross-members */}
      {([0, Math.PI / 2] as number[]).map((ry, i) => (
        <mesh key={i+2} position={[0, standH * 0.45, 0]} rotation={[0, ry, 0]}>
          <boxGeometry args={[w * 0.72, 0.03, 0.04]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      {/* Padded body – tapers slightly inward */}
      <mesh position={[0, standH * 0.7 + standH * 0.15, 0]} castShadow>
        <boxGeometry args={[w * 0.78, standH * 0.3, d * 0.78]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.65} metalness={0} />
      </mesh>
      {/* Top padding block – full width (slightly wider than body) */}
      <mesh position={[0, standH + padH / 2, 0]} castShadow>
        <boxGeometry args={[w + 0.02, padH, d + 0.02]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.65} metalness={0} />
      </mesh>
      {/* Leather top surface */}
      <mesh position={[0, totalH + 0.004, 0]} castShadow>
        <boxGeometry args={[w - 0.02, 0.008, d - 0.02]} />
        <meshPhysicalMaterial color={topColor} roughness={0.88} metalness={0} />
      </mesh>
      {/* Contrast piping / seam lines on top */}
      {([0, Math.PI / 2] as number[]).map((ry, i) => (
        <mesh key={i} position={[0, totalH + 0.009, 0]} rotation={[0, ry, 0]}>
          <boxGeometry args={[w - 0.06, 0.003, 0.018]} />
          <meshPhysicalMaterial color="#8B7055" roughness={0.7} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trampett / Mini-tramp – steel tube frame, visible springs, fabric bed
// ---------------------------------------------------------------------------

function Trampette({
  w, d, color, partColors,
}: { w: number; d: number; color?: string; partColors?: Record<string, string> }) {
  const legH       = 0.20;
  const frameT     = 0.030;   // frame tube thickness
  const tilt       = 0.10;    // slight forward incline (radians)
  const frameColor = pc(partColors, "ram",   "#232C3A");
  const bedColor   = pc(partColors, "matta", color ?? "#B02020");
  const springColor = "#6B7080";

  // Springs: evenly spaced along long edges, angled inward ~30°
  const nSprings = Math.max(3, Math.round((w - 0.15) / 0.18));
  const springLen = 0.085;

  return (
    <group rotation={[-tilt, 0, 0]} position={[0, legH + frameT * 0.5, 0]}>
      {/* Four corner legs */}
      {([
        [-w / 2 + 0.07, -d / 2 + 0.07],
        [ w / 2 - 0.07, -d / 2 + 0.07],
        [-w / 2 + 0.07,  d / 2 - 0.07],
        [ w / 2 - 0.07,  d / 2 - 0.07],
      ] as [number, number][]).map(([px, pz], i) => (
        <mesh key={`leg-${i}`} position={[px, -legH / 2, pz]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, legH, 8]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.3} metalness={0.85} />
        </mesh>
      ))}

      {/* Frame border – 4 sides */}
      {([-d / 2 + 0.04, d / 2 - 0.04] as number[]).map((z, i) => (
        <mesh key={`fs-${i}`} position={[0, 0, z]} castShadow>
          <boxGeometry args={[w - 0.08, frameT, frameT]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.3} metalness={0.85} />
        </mesh>
      ))}
      {([-w / 2 + 0.04, w / 2 - 0.04] as number[]).map((x, i) => (
        <mesh key={`fe-${i}`} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[frameT, frameT, d - 0.08]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.3} metalness={0.85} />
        </mesh>
      ))}

      {/* Springs along the two long sides */}
      {Array.from({ length: nSprings }).flatMap((_, si) => {
        const t  = (si + 0.5) / nSprings;
        const px = -w / 2 + 0.08 + t * (w - 0.16);
        return ([-1, 1] as number[]).map((sz) => {
          const pz = (d / 2 - 0.04) * sz;
          const tiltZ = -sz * 0.52;   // ~30° inward angle
          return (
            <mesh
              key={`sp-${si}-${sz}`}
              position={[px, frameT * 0.5, pz * 0.78]}
              rotation={[tiltZ, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.005, 0.005, springLen, 6]} />
              <meshPhysicalMaterial color={springColor} roughness={0.45} metalness={0.80} />
            </mesh>
          );
        });
      })}

      {/* Trampoline bed */}
      <mesh position={[0, frameT * 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.80, 0.012, d * 0.80]} />
        <meshPhysicalMaterial color={bedColor} roughness={0.80} metalness={0.0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tumblingbana
// ---------------------------------------------------------------------------

function Track({ w, d, h, color }: { w: number; d: number; h: number; color?: string }) {
  const th = Math.max(0.08, h);
  return (
    <group>
      <mesh position={[0, th / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, th, d]} />
        <meshPhysicalMaterial color={color ?? "#4A7A3A"} roughness={0.85} metalness={0} />
      </mesh>
      {([-d / 2 + 0.04, d / 2 - 0.04] as number[]).map((z, i) => (
        <mesh key={i} position={[0, th + 0.003, z]} castShadow>
          <boxGeometry args={[w - 0.1, 0.005, 0.025]} />
          <meshPhysicalMaterial color="#FFFFFF" roughness={0.5} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Airtrack
// ---------------------------------------------------------------------------

function AirTrack({ w, d, h, color }: { w: number; d: number; h: number; color?: string }) {
  const th = Math.max(0.1, h);
  return (
    <group>
      <mesh position={[0, th / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, th, d]} />
        <meshPhysicalMaterial color={color ?? "#2878C0"} roughness={0.5} metalness={0} clearcoat={0.35} clearcoatRoughness={0.3} />
      </mesh>
      <mesh position={[0, th + 0.003, 0]} castShadow>
        <boxGeometry args={[w * 0.6, 0.005, d * 0.3]} />
        <meshPhysicalMaterial color="#1A5A9A" roughness={0.5} metalness={0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Fristående-matta (Floor) – competition-style with red/blue zones + lines
// ---------------------------------------------------------------------------

function Floor({ w, d, color }: { w: number; d: number; color?: string }) {
  const h = 0.1;
  // Competition floor: 12×12 m mat; FIG border ~1 m each side → 10×10 inner area
  const border = Math.min(w, d) * 0.083; // ~1 m for 12 m mat
  const innerW = w - border * 2;
  const innerD = d - border * 2;
  const useCustomColor = !!color;
  const matColor   = color ?? "#1A50C0";   // blue outer mat
  const innerColor = color ? lightenHex(color, 0.25) : "#CC2828"; // red inner (competition color)

  return (
    <group>
      {/* Full mat – acts as blue border */}
      <mesh position={[0, h / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial color={matColor} roughness={0.85} metalness={0} />
      </mesh>
      {/* Red/competition inner area */}
      {!useCustomColor && (
        <mesh position={[0, h + 0.003, 0]} receiveShadow>
          <boxGeometry args={[innerW, 0.006, innerD]} />
          <meshPhysicalMaterial color={innerColor} roughness={0.8} metalness={0} />
        </mesh>
      )}
      {/* White boundary lines on inner edge */}
      {[-innerW / 2, innerW / 2].map((x, i) => (
        <mesh key={`vl${i}`} position={[x, h + 0.009, 0]} receiveShadow>
          <boxGeometry args={[0.05, 0.004, innerD + 0.05]} />
          <meshPhysicalMaterial color="#FFFFFF" roughness={0.4} metalness={0} />
        </mesh>
      ))}
      {[-innerD / 2, innerD / 2].map((z, i) => (
        <mesh key={`hl${i}`} position={[0, h + 0.009, z]} receiveShadow>
          <boxGeometry args={[innerW + 0.05, 0.004, 0.05]} />
          <meshPhysicalMaterial color="#FFFFFF" roughness={0.4} metalness={0} />
        </mesh>
      ))}
      {/* Center cross mark */}
      {[0, Math.PI / 2].map((ry, i) => (
        <mesh key={`cc${i}`} position={[0, h + 0.009, 0]} rotation={[0, ry, 0]} receiveShadow>
          <boxGeometry args={[1.0, 0.004, 0.05]} />
          <meshPhysicalMaterial color="#FFFFFF" roughness={0.4} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ojämna barr (Uneven bars) – FIG: high 2.55 m, low 1.75 m, sep 1.40–1.95 m
// ---------------------------------------------------------------------------

function UnevenBars({
  w, d, partColors, params,
}: { w: number; d: number; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const highBarH  = params?.highBarH ?? 2.55;
  const lowBarH   = params?.lowBarH  ?? 1.75;
  const barSep    = params?.barSep   ?? 1.40;
  const barR      = 0.014;
  const postR     = 0.036;
  const baseH     = 0.04;
  const barLen    = Math.min(w * 0.88, 2.4);
  const barColor  = pc(partColors, "räcken",  "#CDD2DA");
  const frameColor = pc(partColors, "ram",    "#CDD2DA");
  const postXs    = [-barLen / 2 + 0.06, barLen / 2 - 0.06] as number[];

  const cable = (key: string, from: [number,number,number], to: [number,number,number]) => {
    const dx = to[0]-from[0], dy = to[1]-from[1], dz = to[2]-from[2];
    const len = Math.hypot(dx, dy, dz);
    const mid: [number,number,number] = [(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2];
    return (
      <mesh key={key} position={mid} quaternion={alignY(dx, dy, dz)} castShadow>
        <cylinderGeometry args={[0.006, 0.006, len, 4]} />
        <meshPhysicalMaterial color="#607880" roughness={0.4} metalness={0.88} />
      </mesh>
    );
  };

  return (
    <group>
      {/* Base plates – one per post (4 total) */}
      {([-barSep / 2, barSep / 2] as number[]).flatMap((z, si) =>
        postXs.map((x, pi) => (
          <mesh key={`base-${si}-${pi}`} position={[x, baseH / 2, z]} receiveShadow castShadow>
            <boxGeometry args={[0.32, baseH, 0.55]} />
            <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
          </mesh>
        ))
      )}

      {/* Posts – high bar (z = -barSep/2) */}
      {postXs.map((x, i) => (
        <mesh key={`hp-${i}`} position={[x, highBarH / 2 + baseH, -barSep / 2]} castShadow>
          <cylinderGeometry args={[postR, postR * 1.12, highBarH, 14]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
        </mesh>
      ))}

      {/* Posts – low bar (z = +barSep/2) */}
      {postXs.map((x, i) => (
        <mesh key={`lp-${i}`} position={[x, lowBarH / 2 + baseH, barSep / 2]} castShadow>
          <cylinderGeometry args={[postR, postR * 1.12, lowBarH, 14]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
        </mesh>
      ))}

      {/* High bar rail */}
      <mesh position={[0, highBarH + baseH, -barSep / 2]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[barR, barLen - barR * 2, 6, 18]} />
        <meshPhysicalMaterial color={barColor} roughness={0.15} metalness={0.95} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>

      {/* Low bar rail */}
      <mesh position={[0, lowBarH + baseH, barSep / 2]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[barR, barLen - barR * 2, 6, 18]} />
        <meshPhysicalMaterial color={barColor} roughness={0.15} metalness={0.95} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>

      {/* Cable stays: each post top → two floor anchors */}
      {postXs.flatMap((x) => [
        cable(`chf-${x}`, [x, highBarH + baseH, -barSep / 2], [x * 1.3, baseH, -(d / 2 - 0.08)]),
        cable(`chi-${x}`, [x, highBarH + baseH, -barSep / 2], [x * 1.2, baseH,  barSep / 2 + 0.12]),
        cable(`clf-${x}`, [x, lowBarH  + baseH,  barSep / 2], [x * 1.3, baseH,   d / 2 - 0.08]),
        cable(`cli-${x}`, [x, lowBarH  + baseH,  barSep / 2], [x * 1.2, baseH, -barSep / 2 - 0.12]),
      ])}
    </group>
  );
}

// ---------------------------------------------------------------------------
// WedgeGeom – right-triangular prism (kil). Slope: front-low → back-high.
// Geometry is centered at bounding-box center so the group can use offsetY+h/2.
// ---------------------------------------------------------------------------

function WedgeGeom({ w, h, d }: { w: number; h: number; d: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // 6 vertices; Y centered at origin (−h/2 … +h/2)
    const v = new Float32Array([
      -w/2, -h/2,  d/2,  // 0 front-bottom-left  (thin end)
       w/2, -h/2,  d/2,  // 1 front-bottom-right
      -w/2, -h/2, -d/2,  // 2 back-bottom-left
       w/2, -h/2, -d/2,  // 3 back-bottom-right
      -w/2,  h/2, -d/2,  // 4 back-top-left      (thick end)
       w/2,  h/2, -d/2,  // 5 back-top-right
    ]);
    const idx = new Uint16Array([
      0,3,1, 0,2,3,  // bottom
      2,4,5, 2,5,3,  // back vertical face
      0,1,5, 0,5,4,  // slope face
      0,4,2,         // left triangle
      1,3,5,         // right triangle
    ]);
    g.setAttribute("position", new THREE.BufferAttribute(v, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }, [w, h, d]);
  return <primitive object={geom} />;
}

/** Lighten a hex color by mixing with white by `amount` (0–1). */
function lightenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Mattor (tjockmatta / landningsmatta)
// ---------------------------------------------------------------------------

function Mat({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const th = Math.max(0.06, h);
  return (
    <mesh position={[0, th / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, th, d]} />
      <meshPhysicalMaterial color={color} roughness={0.75} metalness={0} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Plint
// ---------------------------------------------------------------------------

function Plinth({
  w, d, h, color, params,
}: { w: number; d: number; h: number; color?: string; params?: Record<string, number> }) {
  const layers = Math.round(Math.max(1, Math.min(8, params?.layers ?? 4)));
  const layerH = h / layers;
  const topColor = color ?? "#8C6240";
  const bodyColor = color ?? "#7A5330";
  return (
    <group>
      {Array.from({ length: layers }).map((_, i) => {
        const isTop = i === layers - 1;
        const shrink = 1 - i * 0.035;
        return (
          <mesh key={i} position={[0, layerH * (i + 0.5), 0]} castShadow receiveShadow>
            <boxGeometry args={[w * shrink, layerH * 0.94, d * shrink]} />
            <meshPhysicalMaterial
              color={isTop ? topColor : bodyColor}
              roughness={isTop ? 0.7 : 0.55}
              metalness={0}
              clearcoat={isTop ? 0 : 0.2}
              clearcoatRoughness={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bock
// ---------------------------------------------------------------------------

function Buck({
  w, h, color, partColors, params,
}: { w: number; h: number; color?: string; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const totalH = params?.bodyH ?? h;
  const bodyH = Math.max(0.1, totalH - 0.18);
  const bodyColor = pc(partColors, "kropp", color ?? "#8C6240");
  const postColor = pc(partColors, "sockel", "#CDD2DA");

  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.048, 0.065, bodyH, 12]} />
        <meshPhysicalMaterial color={postColor} roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, bodyH, 0]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.55, 0.02, 0.3]} />
        <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
      </mesh>
      <mesh position={[0, totalH - 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.14, Math.max(0.3, w * 0.65), 8, 18]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.7} metalness={0.0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Skumgrop
// ---------------------------------------------------------------------------

function FoamPit({ w, d, color }: { w: number; d: number; color?: string }) {
  const wallH = 0.75;
  const foamColors = color
    ? [color, color, color, color]
    : ["#5090C8", "#4880B8", "#3A70A8", "#60A0D8"];
  return (
    <group position={[0, -0.05, 0]}>
      <mesh position={[0, -wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, wallH, d]} />
        <meshPhysicalMaterial color="#2A3A28" roughness={0.85} metalness={0} />
      </mesh>
      {Array.from({ length: 6 }).flatMap((_, ix) =>
        Array.from({ length: 5 }).map((_, iz) => {
          const cellW = w / 6;
          const cellD = d / 5;
          const px = -w / 2 + cellW * (ix + 0.5);
          const pz = -d / 2 + cellD * (iz + 0.5);
          return (
            <mesh key={`${ix}-${iz}`} position={[px, -0.06, pz]} rotation={[0, (ix * 17 + iz * 11) * 0.08, 0]} castShadow>
              <boxGeometry args={[cellW * 0.82, 0.22, cellD * 0.82]} />
              <meshPhysicalMaterial color={foamColors[(ix + iz) % foamColors.length]} roughness={0.9} metalness={0} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}
