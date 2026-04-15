import type { EquipmentType } from "../../types";

type Props = { type: EquipmentType };

/**
 * Mappar varje redskaps detail.kind till en 3D-modell sammansatt av
 * primitiver med PBR-material. Origo = redskapets centrum på golvet (y=0),
 * x i meter (bredd), z i meter (djup), y uppåt.
 */
export function Equipment3D({ type }: Props) {
  switch (type.detail?.kind) {
    case "parallel-bars":
      return <ParallelBars w={type.widthM} d={type.heightM} />;
    case "high-bar":
      return <HighBar w={type.widthM} d={type.heightM} />;
    case "beam":
      return <Beam w={type.widthM} d={type.heightM} />;
    case "pommel-horse":
      return <PommelHorse w={type.widthM} d={type.heightM} />;
    case "rings":
      return <Rings w={type.widthM} d={type.heightM} h={type.physicalHeightM} />;
    case "vault":
      return <Vault w={type.widthM} d={type.heightM} />;
    case "trampette":
    case "mini-tramp":
      return <Trampette w={type.widthM} d={type.heightM} />;
    case "tumbling-track":
      return <Track w={type.widthM} d={type.heightM} h={type.physicalHeightM} color="#5A8C4A" />;
    case "air-track":
      return <AirTrack w={type.widthM} d={type.heightM} />;
    case "floor":
      return <Floor w={type.widthM} d={type.heightM} />;
    case "thick-mat":
      return <Mat w={type.widthM} d={type.heightM} h={type.physicalHeightM} color="#4F86C7" />;
    case "landing-mat":
      return <Mat w={type.widthM} d={type.heightM} h={type.physicalHeightM} color="#D48850" />;
    case "plinth":
      return <Plinth w={type.widthM} d={type.heightM} h={type.physicalHeightM} />;
    case "buck":
      return <Buck w={type.widthM} d={type.heightM} h={type.physicalHeightM} />;
    case "foam-pit":
      return <FoamPit w={type.widthM} d={type.heightM} />;
    default:
      return (
        <mesh position={[0, type.physicalHeightM / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[type.widthM, Math.max(0.1, type.physicalHeightM), type.heightM]} />
          <meshStandardMaterial color={type.color} roughness={0.7} />
        </mesh>
      );
  }
}

const WOOD_LIGHT = { color: "#C4915A", roughness: 0.55, metalness: 0.05 };
const METAL = { color: "#C8CDD3", roughness: 0.18, metalness: 0.95 };
const METAL_DARK = { color: "#3A4150", roughness: 0.35, metalness: 0.85 };
const LEATHER = { color: "#7C4F33", roughness: 0.65, metalness: 0.05 };
const RUBBER_RED = { color: "#C0271F", roughness: 0.45, metalness: 0.0 };

function ParallelBars({ w, d }: { w: number; d: number }) {
  const railLen = w;
  const railR = 0.025;
  const railH1 = 1.7;
  const railH2 = 1.95;
  const baseH = 0.04;
  const postR = 0.04;
  return (
    <group>
      {/* Bottenplatta */}
      <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshStandardMaterial color="#1F2937" roughness={0.7} />
      </mesh>
      {/* 4 vertikala stolpar */}
      {[-d * 0.4, d * 0.4].flatMap((zOff) =>
        [-w * 0.42, w * 0.42].map((xOff, i) => (
          <mesh
            key={`${zOff}-${i}`}
            position={[xOff, railH2 / 2 + baseH, zOff]}
            castShadow
          >
            <cylinderGeometry args={[postR, postR, railH2, 14]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
        )),
      )}
      {/* Två räcken */}
      {[
        { z: -d * 0.4, h: railH1 + baseH },
        { z: d * 0.4, h: railH2 + baseH },
      ].map(({ z, h }, i) => (
        <mesh
          key={i}
          position={[0, h, z]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[railR, railR, railLen, 18]} />
          <meshStandardMaterial {...WOOD_LIGHT} />
        </mesh>
      ))}
    </group>
  );
}

function HighBar({ w, d }: { w: number; d: number }) {
  const barH = 2.75;
  const barR = 0.014;
  const postR = 0.05;
  const baseH = 0.05;
  const xPost = w * 0.45;
  return (
    <group>
      <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, baseH, d]} />
        <meshStandardMaterial color="#1F2937" roughness={0.7} />
      </mesh>
      {[-xPost, xPost].map((x, i) => (
        <mesh key={i} position={[x, barH / 2 + baseH, 0]} castShadow>
          <cylinderGeometry args={[postR, postR * 1.2, barH, 16]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      {/* Vajrar – tunna cylindrar diagonalt */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => {
          const from: [number, number, number] = [xPost * sx, barH * 0.85, 0];
          const to: [number, number, number] = [xPost * sx + sx * 0.6, baseH, sz * d * 0.4];
          const dx = to[0] - from[0];
          const dy = to[1] - from[1];
          const dz = to[2] - from[2];
          const len = Math.hypot(dx, dy, dz);
          const mid: [number, number, number] = [
            (from[0] + to[0]) / 2,
            (from[1] + to[1]) / 2,
            (from[2] + to[2]) / 2,
          ];
          const ay = Math.atan2(dx, dz);
          const ax = Math.atan2(Math.hypot(dx, dz), dy);
          return (
            <mesh
              key={`${sx}-${sz}`}
              position={mid}
              rotation={[ax, ay, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.005, 0.005, len, 6]} />
              <meshStandardMaterial color="#888" roughness={0.4} metalness={0.7} />
            </mesh>
          );
        }),
      )}
      {/* Stång */}
      <mesh
        position={[0, barH + baseH, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[barR, barR, w, 14]} />
        <meshStandardMaterial color="#E8EAF0" roughness={0.18} metalness={0.95} />
      </mesh>
    </group>
  );
}

function Beam({ w, d }: { w: number; d: number }) {
  const beamH = 1.25;
  const beamW = 0.1;
  const beamD = w; // bommen är lång
  const baseH = 0.03;
  return (
    <group>
      {/* Två fötter */}
      {[-w * 0.4, w * 0.4].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, beamH / 2, 0]} castShadow>
            <boxGeometry args={[0.1, beamH, 0.5]} />
            <meshStandardMaterial color="#1F2937" roughness={0.6} />
          </mesh>
          <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.5, baseH, 0.6]} />
            <meshStandardMaterial color="#0F172A" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* Bommen själv */}
      <mesh position={[0, beamH + 0.05, 0]} castShadow rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[Math.max(0.4, d), 0.1, beamD]} />
        <meshStandardMaterial color="#C99761" roughness={0.45} metalness={0.05} />
      </mesh>
      {/* Top suede stripe (filt) */}
      <mesh position={[0, beamH + 0.105, 0]} castShadow rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[Math.max(0.3, d * 0.8), 0.005, beamD]} />
        <meshStandardMaterial color="#E8C99A" roughness={0.95} metalness={0} />
      </mesh>
      {/* Suppress unused */}
      <group visible={false}><mesh><boxGeometry args={[beamW, beamW, beamW]} /></mesh></group>
    </group>
  );
}

function PommelHorse({ w, d }: { w: number; d: number }) {
  const bodyH = 0.4;
  const standH = 0.75;
  return (
    <group>
      {/* Standar */}
      {[-w * 0.3, w * 0.3].map((x, i) => (
        <mesh key={i} position={[x, standH / 2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, standH, 12]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      {/* Huvudkropp (läder) */}
      <mesh position={[0, standH + bodyH / 2, 0]} castShadow>
        <boxGeometry args={[w * 0.95, bodyH, d * 1.3]} />
        <meshStandardMaterial {...LEATHER} />
      </mesh>
      {/* Två byglar */}
      {[-w * 0.18, w * 0.18].map((x, i) => (
        <mesh
          key={i}
          position={[x, standH + bodyH + 0.08, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[0.08, 0.018, 12, 22]} />
          <meshStandardMaterial color="#E2C893" roughness={0.45} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function Rings({ w, d, h }: { w: number; d: number; h: number }) {
  const ringR = 0.085;
  const ringT = 0.018;
  const cableH = h - 0.4;
  const ringY = h - 0.7;
  return (
    <group>
      {/* Bottenmarkering (subtil ring på golvet) */}
      <mesh
        position={[0, 0.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <ringGeometry args={[Math.max(w, d) * 0.45, Math.max(w, d) * 0.5, 32]} />
        <meshStandardMaterial color="#A8916A" roughness={0.9} transparent opacity={0.4} />
      </mesh>
      {/* Två ringar med kablar */}
      {[-0.25, 0.25].map((dx, i) => (
        <group key={i} position={[dx, 0, 0]}>
          {/* Kabel uppåt – tunn cylinder */}
          <mesh position={[0, ringY + cableH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.005, 0.005, cableH, 6]} />
            <meshStandardMaterial color="#5C4A2E" roughness={0.85} />
          </mesh>
          {/* Ringen (torus) */}
          <mesh
            position={[0, ringY, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <torusGeometry args={[ringR, ringT, 14, 28]} />
            <meshStandardMaterial color="#C99445" roughness={0.4} metalness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Vault({ w, d }: { w: number; d: number }) {
  const standH = 0.95;
  const padH = 0.4;
  return (
    <group>
      <mesh position={[0, standH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, standH, 12]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Pad */}
      <mesh position={[0, standH + padH / 2, 0]} castShadow>
        <boxGeometry args={[w * 0.95, padH, d * 1.05]} />
        <meshStandardMaterial color="#9B6A47" roughness={0.6} metalness={0.05} />
      </mesh>
    </group>
  );
}

function Trampette({ w, d }: { w: number; d: number }) {
  const tilt = 0.18;
  const frameH = 0.3;
  return (
    <group rotation={[-tilt, 0, 0]} position={[0, frameH * 0.55, 0]}>
      {/* Ram */}
      <mesh castShadow>
        <boxGeometry args={[w, frameH * 0.4, d]} />
        <meshStandardMaterial {...METAL_DARK} />
      </mesh>
      {/* Studsbädd */}
      <mesh position={[0, frameH * 0.21, 0]} castShadow>
        <boxGeometry args={[w * 0.85, 0.02, d * 0.85]} />
        <meshStandardMaterial {...RUBBER_RED} />
      </mesh>
      {/* Fötter */}
      {[
        [-w / 2 + 0.07, -frameH / 2, -d / 2 + 0.07],
        [w / 2 - 0.07, -frameH / 2, -d / 2 + 0.07],
        [-w / 2 + 0.07, -frameH / 2, d / 2 - 0.07],
        [w / 2 - 0.07, -frameH / 2, d / 2 - 0.07],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, frameH * 0.3, 8]} />
          <meshStandardMaterial color="#0B0F18" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Mat({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, Math.max(0.05, h), d]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Track({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, Math.max(0.06, h), d]} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}

function AirTrack({ w, d }: { w: number; d: number }) {
  const h = 0.3;
  return (
    <group>
      {/* Huvudkropp som rund cylinder */}
      <mesh
        position={[0, h / 2, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[h / 2, h / 2, w, 24]} />
        <meshStandardMaterial color="#3185BC" roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Topplatta för att markera ovansidan */}
      <mesh position={[0, h, 0]} castShadow>
        <boxGeometry args={[w, 0.005, d]} />
        <meshStandardMaterial color="#5DB2E0" roughness={0.55} />
      </mesh>
    </group>
  );
}

function Floor({ w, d }: { w: number; d: number }) {
  const h = 0.1;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#8FB894" roughness={0.95} />
      </mesh>
      {/* Tävlingslinje (lite ovanför topp) */}
      <mesh position={[0, h + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[Math.min(w, d) * 0.42, Math.min(w, d) * 0.44, 4, 1]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Plinth({ w, d, h }: { w: number; d: number; h: number }) {
  const layers = 4;
  const layerH = h / layers;
  return (
    <group>
      {Array.from({ length: layers }).map((_, i) => {
        const shrink = 1 - i * 0.04;
        return (
          <mesh
            key={i}
            position={[0, layerH * (i + 0.5), 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[w * shrink, layerH * 0.92, d * shrink]} />
            <meshStandardMaterial
              color={i === layers - 1 ? "#7C4F33" : "#B7895B"}
              roughness={i === layers - 1 ? 0.7 : 0.55}
              metalness={0.05}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Buck({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* Stand */}
      <mesh position={[0, (h - 0.15) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, h - 0.15, 10]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Top läder-rull */}
      <mesh position={[0, h - 0.075, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, Math.max(0.4, w * 0.7), 18]} />
        <meshStandardMaterial color="#A47551" roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh visible={false}><boxGeometry args={[d, d, d]} /></mesh>
    </group>
  );
}

function FoamPit({ w, d }: { w: number; d: number }) {
  return (
    <group position={[0, -0.05, 0]}>
      {/* Pit edge */}
      <mesh position={[0, -0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.8, d]} />
        <meshStandardMaterial color="#3A4A2F" roughness={0.85} />
      </mesh>
      {/* Skum-fyllnad – flera små kuber */}
      {Array.from({ length: 5 }).flatMap((_, ix) =>
        Array.from({ length: 4 }).map((_, iz) => {
          const cellW = w / 5;
          const cellD = d / 4;
          const px = -w / 2 + cellW * (ix + 0.5);
          const pz = -d / 2 + cellD * (iz + 0.5);
          const colors = ["#9CCB89", "#86C26F", "#6E8C5E", "#B5DBA4"];
          return (
            <mesh
              key={`${ix}-${iz}`}
              position={[px, -0.05, pz]}
              rotation={[0, (ix * 13 + iz * 7) * 0.1, 0]}
              receiveShadow
            >
              <boxGeometry args={[cellW * 0.85, 0.18, cellD * 0.85]} />
              <meshStandardMaterial color={colors[(ix + iz) % colors.length]} roughness={0.9} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}
