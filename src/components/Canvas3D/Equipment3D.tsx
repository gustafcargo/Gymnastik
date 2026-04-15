import type { EquipmentType } from "../../types";

type Props = { type: EquipmentType; color?: string };

export function Equipment3D({ type, color }: Props) {
  switch (type.detail?.kind) {
    case "parallel-bars":
      return <ParallelBars w={type.widthM} d={type.heightM} color={color} />;
    case "high-bar":
      return <HighBar w={type.widthM} d={type.heightM} color={color} />;
    case "beam":
      return <Beam w={type.widthM} color={color} />;
    case "pommel-horse":
      return <PommelHorse w={type.widthM} color={color} />;
    case "rings":
      return <Rings w={type.widthM} d={type.heightM} h={type.physicalHeightM} />;
    case "vault":
      return <Vault w={type.widthM} d={type.heightM} color={color} />;
    case "trampette":
    case "mini-tramp":
      return <Trampette w={type.widthM} d={type.heightM} color={color} />;
    case "tumbling-track":
      return <Track w={type.widthM} d={type.heightM} h={type.physicalHeightM} color={color} />;
    case "air-track":
      return <AirTrack w={type.widthM} d={type.heightM} color={color} />;
    case "floor":
      return <Floor w={type.widthM} d={type.heightM} color={color} />;
    case "thick-mat":
      return <Mat w={type.widthM} d={type.heightM} h={type.physicalHeightM} color={color ?? "#2A60A0"} />;
    case "landing-mat":
      return <Mat w={type.widthM} d={type.heightM} h={type.physicalHeightM} color={color ?? "#CC7020"} />;
    case "plinth":
      return <Plinth w={type.widthM} d={type.heightM} h={type.physicalHeightM} color={color} />;
    case "buck":
      return <Buck w={type.widthM} h={type.physicalHeightM} color={color} />;
    case "foam-pit":
      return <FoamPit w={type.widthM} d={type.heightM} color={color} />;
    default:
      return (
        <mesh position={[0, type.physicalHeightM / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[type.widthM, Math.max(0.1, type.physicalHeightM), type.heightM]} />
          <meshPhysicalMaterial color={color ?? type.color} roughness={0.7} metalness={0} />
        </mesh>
      );
  }
}

// ---------------------------------------------------------------------------
// Barr (Parallel bars)
// ---------------------------------------------------------------------------

function ParallelBars({ w, d, color }: { w: number; d: number; color?: string }) {
  const railH1 = 1.7;
  const railH2 = 1.95;
  const railR = 0.025;
  const postR = 0.04;
  const baseH = 0.04;

  return (
    <group>
      <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
      </mesh>

      {([
        { zOff: -d * 0.4, h: railH1 },
        { zOff:  d * 0.4, h: railH2 },
      ] as { zOff: number; h: number }[]).flatMap(({ zOff, h }) =>
        ([-w * 0.42, w * 0.42] as number[]).map((xOff, i) => (
          <mesh key={`${zOff}-${i}`} position={[xOff, h / 2 + baseH, zOff]} castShadow>
            <cylinderGeometry args={[postR, postR * 1.1, h, 20]} />
            <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
          </mesh>
        )),
      )}

      {[{ z: -d * 0.4, h: railH1 + baseH }, { z: d * 0.4, h: railH2 + baseH }].map(({ z, h }, i) => (
        <mesh key={i} position={[0, h, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[railR, w - railR * 2, 6, 18]} />
          <meshPhysicalMaterial color={color ?? "#B8824A"} roughness={0.38} metalness={0.0} clearcoat={0.45} clearcoatRoughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Räck (High bar)
// ---------------------------------------------------------------------------

function HighBar({ w, d, color }: { w: number; d: number; color?: string }) {
  const barH = 2.75;
  const barR = 0.014;
  const postR = 0.048;
  const baseH = 0.05;
  const xPost = w * 0.45;

  return (
    <group>
      <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
      </mesh>

      {([-xPost, xPost] as number[]).map((x, i) => (
        <mesh key={i} position={[x, barH / 2 + baseH, 0]} castShadow>
          <cylinderGeometry args={[postR, postR * 1.15, barH, 18]} />
          <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
        </mesh>
      ))}

      {([-1, 1] as number[]).flatMap((sx) =>
        ([-1, 1] as number[]).map((sz) => {
          // Wire from top of each upright to the nearest corner of the base plate
          const from: [number, number, number] = [xPost * sx, barH + baseH, 0];
          const to: [number, number, number] = [(w / 2 - 0.04) * sx, baseH, (d / 2 - 0.04) * sz];
          const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
          const len = Math.hypot(dx, dy, dz);
          const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
          return (
            <mesh key={`${sx}-${sz}`} position={mid} rotation={[Math.atan2(Math.hypot(dx, dz), dy), Math.atan2(dx, dz), 0]} castShadow>
              <cylinderGeometry args={[0.006, 0.006, len, 6]} />
              <meshPhysicalMaterial color="#A8B0BA" roughness={0.4} metalness={0.88} />
            </mesh>
          );
        }),
      )}

      <mesh position={[0, barH + baseH, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[barR, w - barR * 2, 6, 16]} />
        <meshPhysicalMaterial color={color ?? "#CDD2DA"} roughness={color ? 0.4 : 0.08} metalness={color ? 0.0 : 1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bom (Balance beam)
// ---------------------------------------------------------------------------

function Beam({ w, color }: { w: number; color?: string }) {
  const beamH = 1.25;
  const baseH = 0.03;

  return (
    <group>
      {([-w * 0.38, w * 0.38] as number[]).map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, beamH * 0.5, 0]} castShadow>
            <boxGeometry args={[0.12, beamH, 0.45]} />
            <meshPhysicalMaterial color={color ?? "#CC2020"} roughness={0.8} metalness={0.0} />
          </mesh>
          <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.5, baseH, 0.55]} />
            <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
          </mesh>
        </group>
      ))}

      {/* Bomkropp längs X-axeln */}
      <group position={[0, beamH + 0.055, 0]}>
        <mesh castShadow>
          <boxGeometry args={[w, 0.1, 0.1]} />
          <meshPhysicalMaterial color="#8C6240" roughness={0.7} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0.053, 0]} castShadow>
          <boxGeometry args={[w - 0.02, 0.005, 0.08]} />
          <meshPhysicalMaterial color="#D4B07A" roughness={1.0} metalness={0.0} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bygelhäst (Pommel horse)
// ---------------------------------------------------------------------------

function PommelHorse({ w, color }: { w: number; color?: string }) {
  const standH = 0.78;
  const bodyH = 0.38;
  const bodyD = 0.42;

  return (
    <group>
      {([-w * 0.32, w * 0.32] as number[]).flatMap((x) =>
        ([-bodyD * 0.32, bodyD * 0.32] as number[]).map((z, i) => (
          <mesh key={`${x}-${i}`} position={[x, standH / 2, z]} castShadow>
            <cylinderGeometry args={[0.025, 0.032, standH, 14]} />
            <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
          </mesh>
        )),
      )}

      <mesh position={[0, standH + bodyH / 2, 0]} castShadow>
        <boxGeometry args={[w * 0.95, bodyH, bodyD]} />
        <meshPhysicalMaterial color={color ?? "#8C6240"} roughness={0.7} metalness={0.0} />
      </mesh>

      {([-w * 0.2, w * 0.2] as number[]).map((x, i) => (
        <mesh key={i} position={[x, standH + bodyH + 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.09, 0.018, 14, 24, Math.PI]} />
          <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ringar (Rings)
// ---------------------------------------------------------------------------

function Rings({ w, d, h }: { w: number; d: number; h: number }) {
  const ringR = 0.085;
  const ringT = 0.018;
  const strapH = h - 0.55;
  const ringY = h - 0.65;

  return (
    <group>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[Math.max(w, d) * 0.42, Math.max(w, d) * 0.48, 32]} />
        <meshPhysicalMaterial color="#8A9BAE" roughness={0.9} transparent opacity={0.3} metalness={0} />
      </mesh>

      {([-0.28, 0.28] as number[]).map((dx, i) => (
        <group key={i} position={[dx, 0, 0]}>
          <mesh position={[0, ringY + strapH / 2 + ringR, 0]} castShadow>
            <boxGeometry args={[0.032, strapH, 0.012]} />
            <meshPhysicalMaterial color="#8C6240" roughness={0.7} metalness={0.0} />
          </mesh>
          <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[ringR, ringT, 14, 32]} />
            <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Hoppbord (Vault)
// ---------------------------------------------------------------------------

function Vault({ w, d, color }: { w: number; d: number; color?: string }) {
  const standH = 0.98;
  const padH = 0.38;

  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.7, 0.04, d * 0.7]} />
        <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
      </mesh>
      <mesh position={[0, standH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.075, standH, 14]} />
        <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, standH + padH / 2, 0]} castShadow>
        <boxGeometry args={[w, padH, d]} />
        <meshPhysicalMaterial color={color ?? "#8C6240"} roughness={0.7} metalness={0.0} />
      </mesh>
      <mesh position={[0, standH + padH + 0.003, 0]} castShadow>
        <boxGeometry args={[w - 0.04, 0.005, d - 0.04]} />
        <meshPhysicalMaterial color="#D4B07A" roughness={1.0} metalness={0.0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trampett / Mini-tramp
// ---------------------------------------------------------------------------

function Trampette({ w, d, color }: { w: number; d: number; color?: string }) {
  const frameH = 0.28;
  const tilt = 0.15;

  return (
    <group rotation={[-tilt, 0, 0]} position={[0, frameH * 0.6, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w, frameH * 0.35, d]} />
        <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
      </mesh>
      <mesh position={[0, frameH * 0.19, 0]} castShadow>
        <boxGeometry args={[w * 0.84, 0.018, d * 0.84]} />
        <meshPhysicalMaterial color={color ?? "#B82020"} roughness={0.72} metalness={0} />
      </mesh>
      {([[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]] as [number, number][]).map(([px, pz], i) => (
        <mesh key={i} position={[px, -frameH * 0.5, pz]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, frameH * 0.4, 8]} />
          <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
        </mesh>
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

function AirTrack({ w, d, color }: { w: number; d: number; color?: string }) {
  const h = 0.28;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial color={color ?? "#2878C0"} roughness={0.5} metalness={0} clearcoat={0.35} clearcoatRoughness={0.3} />
      </mesh>
      <mesh position={[0, h + 0.003, 0]} castShadow>
        <boxGeometry args={[w * 0.6, 0.005, d * 0.3]} />
        <meshPhysicalMaterial color="#1A5A9A" roughness={0.5} metalness={0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Fristående-matta (Floor)
// ---------------------------------------------------------------------------

function Floor({ w, d, color }: { w: number; d: number; color?: string }) {
  const h = 0.08;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshPhysicalMaterial color={color ?? "#7AAE7E"} roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, h + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[Math.min(w, d) * 0.44, Math.min(w, d) * 0.47, 4, 1]} />
        <meshPhysicalMaterial color="#FFFFFF" roughness={0.4} metalness={0} />
      </mesh>
    </group>
  );
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

function Plinth({ w, d, h, color }: { w: number; d: number; h: number; color?: string }) {
  const layers = 4;
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

function Buck({ w, h, color }: { w: number; h: number; color?: string }) {
  const bodyH = Math.max(0.1, h - 0.18);
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.048, 0.065, bodyH, 12]} />
        <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, bodyH, 0]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.55, 0.02, 0.3]} />
        <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />
      </mesh>
      <mesh position={[0, h - 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.14, Math.max(0.3, w * 0.65), 8, 18]} />
        <meshPhysicalMaterial color={color ?? "#8C6240"} roughness={0.7} metalness={0.0} />
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
