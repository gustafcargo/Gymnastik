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
  const hitH = Math.max(0.15, type.physicalHeightM);
  const hitW = type.widthM;
  const hitD = type.heightM;

  function model() {
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
      case "rings-free":
        return <RingsFree h={type.physicalHeightM} partColors={partColors} params={params} />;
      case "uneven-bars":
        return <UnevenBars w={type.widthM} d={type.heightM} partColors={partColors} params={params} />;
      case "vault":
        return <Vault w={type.widthM} d={type.heightM} color={color} partColors={partColors} params={params} />;
      case "trampette":
        return <Trampette w={type.widthM} d={type.heightM} color={color} partColors={partColors} />;
      case "mini-tramp":
        return <MiniTramp w={type.widthM} d={type.heightM} color={color} partColors={partColors} />;
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
      case "wall-bars":
        return <WallBars h={type.physicalHeightM} partColors={partColors} params={params} />;
      case "gym-bench":
        return <GymBench w={type.widthM} partColors={partColors} params={params} />;
      case "climbing-rope":
        return <ClimbingRope h={params?.ropeH ?? type.physicalHeightM} partColors={partColors} />;
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
  } // end switch
  } // end model()

  return (
    <>
      {model()}
      {/* Invisible bounding box for reliable raycasting on thin geometry (rings, beam, etc.) */}
      <mesh position={[0, hitH / 2, 0]}>
        <boxGeometry args={[hitW, hitH, hitD]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
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
  const railColor  = pc(partColors, "räcken", color ?? "#B8824A");
  const frameColor = pc(partColors, "ram",    "#CDD2DA");
  const baseColor  = pc(partColors, "sockel", "#252D3A");

  const postXs = [-barLen / 2 + 0.06, barLen / 2 - 0.06] as number[];

  return (
    <group>
      {/* Base plates for each side */}
      {([-railSpacing / 2, railSpacing / 2] as number[]).map((z, si) => (
        postXs.map((x, pi) => (
          <mesh key={`base-${si}-${pi}`} position={[x, baseH / 2, z]} receiveShadow castShadow>
            <boxGeometry args={[0.35, baseH, 0.42]} />
            <meshPhysicalMaterial color={baseColor} roughness={0.5} metalness={0.75} />
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

  const barColor   = pc(partColors, "stång",   color ?? "#CDD2DA");
  const postColor  = pc(partColors, "stommar", "#CDD2DA");
  const wireColor  = pc(partColors, "vajrar",  "#A8B0BA");
  const baseColor  = pc(partColors, "sockel",  "#252D3A");

  return (
    <group>
      {/* Two separate base plates (one per upright) */}
      {([-xPost, xPost] as number[]).map((x, i) => (
        <mesh key={`base-${i}`} position={[x, baseH / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.45, baseH, Math.min(d * 0.80, 1.10)]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.5} metalness={0.75} />
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

  const postColor  = pc(partColors, "stöd",   color ?? "#C82020");
  const bodyColor  = pc(partColors, "bom",    "#4A2810");
  const topColor   = pc(partColors, "yta",    "#B8875A");
  const baseColor  = pc(partColors, "sockel", "#EEEEEE");  // white rubber feet
  const tBar       = 0.70;   // T-bar arm half-length (total 1.40 m foot span)

  const postXs = [-w * 0.36, w * 0.36] as number[];

  return (
    <group>
      {postXs.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {/* T-bar foot — one arm along Z perpendicular to beam */}
          <mesh position={[0, 0.018, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.06, 0.035, tBar * 2]} />
            <meshPhysicalMaterial color="#7A7A8A" roughness={0.45} metalness={0.72} />
          </mesh>
          {/* White rubber foot pads at T-arm ends */}
          {([-tBar + 0.05, tBar - 0.05] as number[]).map((pz, j) => (
            <mesh key={j} position={[0, 0.007, pz]} receiveShadow>
              <boxGeometry args={[0.12, 0.014, 0.18]} />
              <meshPhysicalMaterial color={baseColor} roughness={0.70} metalness={0} />
            </mesh>
          ))}
          {/* Outer fixed post – slim red round tube, lower section */}
          <mesh position={[0, pedestalH * 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.034, 0.038, pedestalH * 0.80, 16]} />
            <meshPhysicalMaterial color={postColor} roughness={0.10} metalness={0.92} clearcoat={0.5} clearcoatRoughness={0.10} />
          </mesh>
          {/* Inner telescoping section — narrower, slides into outer */}
          <mesh position={[0, pedestalH * 0.80, 0]} castShadow>
            <cylinderGeometry args={[0.026, 0.030, pedestalH * 0.44, 16]} />
            <meshPhysicalMaterial color={postColor} roughness={0.08} metalness={0.95} clearcoat={0.55} clearcoatRoughness={0.08} />
          </mesh>
          {/* Gray top bracket / cradle connecting to beam */}
          <mesh position={[0, pedestalH + 0.028, 0]} castShadow>
            <boxGeometry args={[0.15, 0.056, 0.14]} />
            <meshPhysicalMaterial color="#3E4A58" roughness={0.22} metalness={0.88} />
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
  const baseColor   = pc(partColors, "sockel", "#252D3A");

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
            <meshPhysicalMaterial color={baseColor} roughness={0.5} metalness={0.75} />
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

  const frameColor  = pc(partColors, "ram",    "#8B3030");
  const ringColor   = pc(partColors, "ringar", "#CDD2DA");
  const strapColor  = pc(partColors, "remmar", "#6B4A2A");

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
        <meshPhysicalMaterial color={frameColor} roughness={0.5} metalness={0.75} />
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
          {/* Ring – vertical (hanging), in XY plane facing +Z */}
          <mesh position={[0, ringY, 0]} castShadow>
            <torusGeometry args={[ringR, ringT, 16, 36]} />
            <meshPhysicalMaterial color={ringColor} roughness={0.08} metalness={1.0} clearcoat={0.7} clearcoatRoughness={0.06} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ringar fri – rings without frame (hanging from ceiling/rig)
// ---------------------------------------------------------------------------

function RingsFree({
  partColors, params, h,
}: { partColors?: Record<string, string>; params?: Record<string, number>; h: number }) {
  const ringH = params?.ringH ?? h;
  const ringR = 0.09;
  const ringT = 0.014;
  const ringSpacing = 0.25;
  const strapH = Math.max(0.1, ringH - 0.2);
  const ringY = Math.max(0.1, ringH - ringR);

  const ringColor = pc(partColors, "ringar", "#CDD2DA");
  const strapColor = pc(partColors, "remmar", "#6B4A2A");

  return (
    <group>
      {([-ringSpacing, ringSpacing] as number[]).map((dx, i) => (
        <group key={i} position={[dx, 0, 0]}>
          {/* Leather strap */}
          <mesh position={[0, ringY + ringR + strapH / 2, 0]} castShadow>
            <boxGeometry args={[0.030, strapH, 0.014]} />
            <meshPhysicalMaterial color={strapColor} roughness={0.75} metalness={0} />
          </mesh>
          {/* Ring – vertical, in XY plane facing +Z */}
          <mesh position={[0, ringY, 0]} castShadow>
            <torusGeometry args={[ringR, ringT, 16, 36]} />
            <meshPhysicalMaterial color={ringColor} roughness={0.08} metalness={1.0} clearcoat={0.7} clearcoatRoughness={0.06} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Hoppbord (Vault table) – Spieth-style: curved orange saddle top,
//   single central column, cross/star base with red foot pads
// ---------------------------------------------------------------------------

function Vault({
  w, d, color, partColors, params,
}: { w: number; d: number; color?: string; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const standH    = params?.standH ?? 1.12;
  const padH      = params?.padH   ?? 0.24;
  const totalH    = standH + padH;
  // Orange body + darker leather surface
  const bodyColor  = pc(partColors, "kropp",   color ?? "#CC4E10");
  const topColor   = pc(partColors, "yta",     "#B84010");
  // Gray column — matches Spieth vault aesthetics
  const metalColor = pc(partColors, "stommar", "#606A74");
  const footColor  = "#B81818";

  const colW = 0.38;
  const colD = 0.30;

  return (
    <group>
      {/* Cross base — 2 arms (front/back + left/right) */}
      {([[1, 0, 0.60, 0.14], [-1, 0, 0.60, 0.14], [0, 1, 0.14, 0.55], [0, -1, 0.14, 0.55]] as [number,number,number,number][]).map(([sx, sz, aw, ad], i) => (
        <mesh key={`arm-${i}`} position={[sx * 0.22, 0.028, sz * 0.22]} castShadow>
          <boxGeometry args={[aw, 0.055, ad]} />
          <meshPhysicalMaterial color={metalColor} roughness={0.30} metalness={0.88} />
        </mesh>
      ))}
      {/* Red rubber foot pads at arm ends */}
      {([[0.52, 0], [-0.52, 0], [0, 0.50], [0, -0.50]] as [number,number][]).map(([px, pz], i) => (
        <mesh key={`foot-${i}`} position={[px, 0.007, pz]} receiveShadow>
          <boxGeometry args={[0.14, 0.014, 0.14]} />
          <meshPhysicalMaterial color={footColor} roughness={0.72} metalness={0.08} />
        </mesh>
      ))}

      {/* Central column */}
      <mesh position={[0, standH / 2 + 0.055, 0]} castShadow>
        <boxGeometry args={[colW, standH, colD]} />
        <meshPhysicalMaterial color={metalColor} roughness={0.22} metalness={0.90} clearcoat={0.25} />
      </mesh>
      {/* Height-adjustment band ring */}
      <mesh position={[0, standH * 0.58, 0]} castShadow>
        <boxGeometry args={[colW + 0.018, 0.048, colD + 0.018]} />
        <meshPhysicalMaterial color="#2E3440" roughness={0.45} metalness={0.72} />
      </mesh>
      {/* Column top cap */}
      <mesh position={[0, standH + 0.055, 0]} castShadow>
        <boxGeometry args={[colW + 0.02, 0.03, colD + 0.02]} />
        <meshPhysicalMaterial color="#404858" roughness={0.30} metalness={0.80} />
      </mesh>

      {/* Saddle pad – main body (box, depth slightly shorter for end rounding) */}
      <mesh position={[0, standH + 0.07 + padH / 2, 0]} castShadow>
        <boxGeometry args={[w, padH, d - padH * 0.85]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.62} metalness={0} />
      </mesh>
      {/* Rounded front edge (approach side — run-up direction) */}
      <mesh position={[0, standH + 0.07 + padH / 2, -(d - padH * 0.85) / 2]}
        rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[padH / 2, padH / 2, w, 20]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.62} metalness={0} />
      </mesh>
      {/* Rounded back edge */}
      <mesh position={[0, standH + 0.07 + padH / 2, (d - padH * 0.85) / 2]}
        rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[padH / 2, padH / 2, w, 20]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.62} metalness={0} />
      </mesh>
      {/* Suede/leather top surface layer */}
      <mesh position={[0, totalH + 0.072, 0]} castShadow>
        <boxGeometry args={[w - 0.01, 0.014, d - 0.01]} />
        <meshPhysicalMaterial color={topColor} roughness={0.92} metalness={0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trampett – Reuther-style springboard: modest incline, visible coil springs,
//            curved padded top surface (orange), wood-coloured base board
// ---------------------------------------------------------------------------

function Trampette({
  w, d, color, partColors,
}: { w: number; d: number; color?: string; partColors?: Record<string, string> }) {
  // Modest incline: front ~0.08 m, rear ~0.22 m ≈ 12°
  const tiltAngle  = 0.22;
  const baseH      = 0.045;    // base board thickness
  const springH    = 0.16;     // spring height (compressed)
  const padH       = 0.075;    // padded top thickness
  const nSprings   = 5;        // 5 prominent load-bearing springs
  const frameColor = pc(partColors, "ram",    "#2A2A2A");
  const padColor   = pc(partColors, "matta",  color ?? "#E06020");  // orange
  const woodColor  = "#C8A060";   // natural wood base
  const springColor = "#4A4A4A";  // dark metal

  return (
    <group>
      {/* Inclined assembly — front low, rear slightly higher */}
      <group rotation={[-tiltAngle, 0, 0]} position={[0, baseH / 2 + 0.01, 0]}>
        {/* Wooden base board */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[w * 0.96, baseH, d * 0.96]} />
          <meshPhysicalMaterial color={woodColor} roughness={0.6} metalness={0} />
        </mesh>
        {/* Metal side frames */}
        {([-w / 2 + 0.015, w / 2 - 0.015] as number[]).map((x, i) => (
          <mesh key={`sf-${i}`} position={[x, (baseH + springH + padH) / 2 - baseH / 2, 0]} castShadow>
            <boxGeometry args={[0.025, baseH + springH + padH, d * 0.96]} />
            <meshPhysicalMaterial color={frameColor} roughness={0.25} metalness={0.88} />
          </mesh>
        ))}

        {/* 5 load-bearing coil springs (thick cylinders) in a row */}
        {Array.from({ length: nSprings }).map((_, si) => {
          const t  = (si + 0.5) / nSprings;
          const pz = -d * 0.42 + t * d * 0.84;
          return (
            <mesh key={`sp-${si}`} position={[0, baseH / 2 + springH / 2, pz]} castShadow>
              <cylinderGeometry args={[0.035, 0.038, springH, 12]} />
              <meshPhysicalMaterial color={springColor} roughness={0.30} metalness={0.88} />
            </mesh>
          );
        })}

        {/* Padded curved top */}
        <mesh position={[0, baseH / 2 + springH + padH / 2, 0]} castShadow>
          <boxGeometry args={[w * 0.93, padH, d * 0.90]} />
          <meshPhysicalMaterial color={padColor} roughness={0.70} metalness={0} />
        </mesh>
        {/* Rounded front edge of pad */}
        <mesh position={[0, baseH / 2 + springH + padH / 2, -d * 0.45]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <cylinderGeometry args={[padH / 2, padH / 2, w * 0.93, 14]} />
          <meshPhysicalMaterial color={padColor} roughness={0.70} metalness={0} />
        </mesh>
        {/* Rounded rear edge of pad */}
        <mesh position={[0, baseH / 2 + springH + padH / 2, d * 0.45]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <cylinderGeometry args={[padH / 2, padH / 2, w * 0.93, 14]} />
          <meshPhysicalMaterial color={padColor} roughness={0.70} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mini-trampolin – NEMO-style: flat elastic surface, A-frame side supports,
//                  adjustable tilt, blue competition pad with grid marking
// ---------------------------------------------------------------------------

function MiniTramp({
  w, d, color, partColors,
}: { w: number; d: number; color?: string; partColors?: Record<string, string> }) {
  const frameColor  = pc(partColors, "ram",   "#3A4050");
  const padColor    = pc(partColors, "matta", color ?? "#1A72B8");  // competition blue
  const footColor   = "#B01818";
  const metalColor  = "#5A6070";
  const frameT      = 0.025;
  const padH        = 0.045;
  const frameH      = 0.06;   // frame surround height
  const legReach    = 0.32;   // how far legs splay outward
  const deviceH     = 0.30;   // surface height from floor

  return (
    <group position={[0, deviceH, 0]}>
      {/* Metal frame surround */}
      {([-d / 2 + frameT / 2, d / 2 - frameT / 2] as number[]).map((z, i) => (
        <mesh key={`fl-${i}`} position={[0, 0, z]} castShadow>
          <boxGeometry args={[w, frameH, frameT]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.25} metalness={0.88} />
        </mesh>
      ))}
      {([-w / 2 + frameT / 2, w / 2 - frameT / 2] as number[]).map((x, i) => (
        <mesh key={`fs-${i}`} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[frameT, frameH, d]} />
          <meshPhysicalMaterial color={frameColor} roughness={0.25} metalness={0.88} />
        </mesh>
      ))}

      {/* Blue padded elastic surface */}
      <mesh position={[0, frameH * 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[w - frameT * 2, padH, d - frameT * 2]} />
        <meshPhysicalMaterial color={padColor} roughness={0.72} metalness={0} />
      </mesh>
      {/* Grid lines on pad (thin raised lines) */}
      {([-w * 0.25, 0, w * 0.25] as number[]).map((px, i) => (
        <mesh key={`gl-${i}`} position={[px, frameH * 0.55 + padH / 2 + 0.002, 0]} castShadow>
          <boxGeometry args={[0.008, 0.004, d - frameT * 3]} />
          <meshPhysicalMaterial color="#3A8AE0" roughness={0.5} metalness={0} />
        </mesh>
      ))}
      {([-d * 0.25, 0, d * 0.25] as number[]).map((pz, i) => (
        <mesh key={`gr-${i}`} position={[0, frameH * 0.55 + padH / 2 + 0.002, pz]} castShadow>
          <boxGeometry args={[w - frameT * 3, 0.004, 0.008]} />
          <meshPhysicalMaterial color="#3A8AE0" roughness={0.5} metalness={0} />
        </mesh>
      ))}

      {/* A-frame leg supports on each long side */}
      {([-1, 1] as number[]).map((sz) => (
        <group key={`af-${sz}`} position={[0, -deviceH / 2, sz * d * 0.22]}>
          {/* Two angled legs per side */}
          {([-w * 0.30, w * 0.30] as number[]).map((px, i) => {
            const legLen = Math.hypot(legReach, deviceH);
            const ang    = Math.atan2(legReach, deviceH);
            return (
              <mesh key={`al-${sz}-${i}`}
                position={[px, 0, sz * legReach / 2]}
                rotation={[sz * ang, 0, 0]}
                castShadow>
                <cylinderGeometry args={[0.018, 0.018, legLen, 8]} />
                <meshPhysicalMaterial color={metalColor} roughness={0.35} metalness={0.85} />
              </mesh>
            );
          })}
          {/* Cross-bar connecting legs */}
          <mesh position={[0, -deviceH * 0.2, sz * legReach * 0.4]} castShadow>
            <boxGeometry args={[w * 0.65, 0.022, 0.022]} />
            <meshPhysicalMaterial color={metalColor} roughness={0.35} metalness={0.85} />
          </mesh>
          {/* Red foot pads */}
          {([-w * 0.30, w * 0.30] as number[]).map((px, i) => (
            <mesh key={`fp-${sz}-${i}`} position={[px, -deviceH / 2, sz * legReach]} receiveShadow>
              <boxGeometry args={[0.12, 0.018, 0.10]} />
              <meshPhysicalMaterial color={footColor} roughness={0.7} metalness={0.1} />
            </mesh>
          ))}
        </group>
      ))}
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
  const barColor   = pc(partColors, "räcken",  "#CDD2DA");
  const frameColor = pc(partColors, "ram",     "#CDD2DA");
  const baseColor  = pc(partColors, "sockel",  "#252D3A");
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
            <meshPhysicalMaterial color={baseColor} roughness={0.5} metalness={0.75} />
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
  const bodyColor  = pc(partColors, "kropp",   color ?? "#8C6240");
  const postColor  = pc(partColors, "stommar",  "#CDD2DA");
  const baseColor  = pc(partColors, "sockel",   "#252D3A");

  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.048, 0.065, bodyH, 12]} />
        <meshPhysicalMaterial color={postColor} roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, bodyH, 0]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.55, 0.02, 0.3]} />
        <meshPhysicalMaterial color={baseColor} roughness={0.5} metalness={0.75} />
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

// ---------------------------------------------------------------------------
// Ribbstol – wall-mounted ladder with side uprights and horizontal rungs
// ---------------------------------------------------------------------------

function WallBars({
  h, partColors, params,
}: { h: number; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const w         = 0.85;
  const depth     = 0.06;   // how far the bars stick out from wall
  const nRungs    = Math.round(params?.rungs ?? 10);
  const upW       = 0.045;  // upright diameter
  const rungR     = 0.018;  // rung radius
  const ramColor  = pc(partColors, "ram",       "#A06028");
  const rungColor = pc(partColors, "pinnar",    "#C8904A");
  const wallColor = pc(partColors, "montering", "#8C7060");

  const rungSpacing = (h - 0.12) / (nRungs - 1);

  return (
    <group>
      {/* Wall mounting rail */}
      <mesh position={[0, h / 2, -(depth / 2 + 0.02)]} castShadow>
        <boxGeometry args={[w + 0.04, h, 0.04]} />
        <meshPhysicalMaterial color={wallColor} roughness={0.7} metalness={0} />
      </mesh>

      {/* Left and right uprights */}
      {([-w / 2 + upW / 2, w / 2 - upW / 2] as number[]).map((x, i) => (
        <mesh key={`up-${i}`} position={[x, h / 2, 0]} castShadow>
          <boxGeometry args={[upW, h, depth]} />
          <meshPhysicalMaterial color={ramColor} roughness={0.55} metalness={0} />
        </mesh>
      ))}

      {/* Horizontal rungs — rotate cylinders to lie along X axis */}
      {Array.from({ length: nRungs }).map((_, ri) => {
        const y = 0.06 + ri * rungSpacing;
        return (
          <mesh key={`rung-${ri}`} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[rungR, rungR, w - upW * 2, 10]} />
            <meshPhysicalMaterial color={rungColor} roughness={0.5} metalness={0} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Gymnastiksätta (gym bench) – flat board on angled leg frames
// ---------------------------------------------------------------------------

function GymBench({
  w, partColors, params,
}: { w: number; partColors?: Record<string, string>; params?: Record<string, number> }) {
  const tiltDeg   = params?.tilt ?? 0;
  const tiltRad   = (tiltDeg * Math.PI) / 180;
  const boardT    = 0.032;  // board thickness
  const boardW    = 0.24;   // board width (narrow side = the seat)
  const legH      = 0.28;   // leg height at floor level
  const legT      = 0.028;
  const nLegs     = Math.max(2, Math.round(w / 1.0));
  const boardColor = pc(partColors, "bräda", "#D4A84B");
  const legColor   = pc(partColors, "ben",   "#B8923A");

  return (
    <group rotation={[tiltRad, 0, 0]} position={[0, 0, tiltRad > 0 ? -(w / 2) * Math.sin(tiltRad) : 0]}>
      {/* Main board */}
      <mesh position={[0, legH + boardT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[boardW, boardT, w]} />
        <meshPhysicalMaterial color={boardColor} roughness={0.6} metalness={0} />
      </mesh>

      {/* Leg pairs */}
      {Array.from({ length: nLegs }).map((_, li) => {
        const pz = -w / 2 + (w / (nLegs - 1)) * li;
        return (
          <group key={`leg-${li}`} position={[0, legH / 2, pz]}>
            {/* Two angled legs forming an A-frame */}
            {([-boardW / 2 + legT, boardW / 2 - legT] as number[]).map((x, i) => (
              <mesh key={i} position={[x, 0, 0]} castShadow>
                <boxGeometry args={[legT, legH, legT]} />
                <meshPhysicalMaterial color={legColor} roughness={0.6} metalness={0} />
              </mesh>
            ))}
            {/* Cross-brace */}
            <mesh position={[0, -legH * 0.2, 0]} castShadow>
              <boxGeometry args={[boardW - legT * 2, legT, legT]} />
              <meshPhysicalMaterial color={legColor} roughness={0.6} metalness={0} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Klätterrep – twisted rope hanging from ceiling
// ---------------------------------------------------------------------------

function ClimbingRope({
  h, partColors,
}: { h: number; partColors?: Record<string, string> }) {
  const ropeR     = 0.030;  // rope radius
  const repColor  = pc(partColors, "rep",    "#8B6A3A");
  const fastColor = pc(partColors, "fäste",  "#3A3A3A");
  const nSegments = Math.max(6, Math.round(h / 0.5));
  const twist     = 0.35;   // radians of spiral per segment

  return (
    <group>
      {/* Ceiling attachment shackle */}
      <mesh position={[0, h + 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
        <meshPhysicalMaterial color={fastColor} roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, h, 0]} castShadow>
        <torusGeometry args={[0.045, 0.012, 8, 20]} />
        <meshPhysicalMaterial color={fastColor} roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Rope segments — slightly spiraling cylinders for twisted look */}
      {Array.from({ length: nSegments }).map((_, si) => {
        const segH = h / nSegments;
        const y    = h - (si + 0.5) * segH;
        const angle = si * twist;
        const offX  = Math.sin(angle) * 0.008;
        const offZ  = Math.cos(angle) * 0.008;
        return (
          <mesh key={si} position={[offX, y, offZ]} castShadow>
            <cylinderGeometry args={[ropeR, ropeR, segH * 1.02, 8]} />
            <meshPhysicalMaterial color={repColor} roughness={0.9} metalness={0} />
          </mesh>
        );
      })}

      {/* Rope end tassel */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <coneGeometry args={[ropeR * 1.6, 0.08, 8]} />
        <meshPhysicalMaterial color={repColor} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}
