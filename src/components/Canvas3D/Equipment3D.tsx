import { RoundedBox } from "@react-three/drei";
import type { EquipmentType } from "../../types";

type Props = { type: EquipmentType };

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
      return <Track w={type.widthM} d={type.heightM} h={type.physicalHeightM} />;
    case "air-track":
      return <AirTrack w={type.widthM} d={type.heightM} />;
    case "floor":
      return <Floor w={type.widthM} d={type.heightM} />;
    case "thick-mat":
      return <ThickMat w={type.widthM} d={type.heightM} h={type.physicalHeightM} />;
    case "landing-mat":
      return <LandingMat w={type.widthM} d={type.heightM} h={type.physicalHeightM} />;
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
          <meshPhysicalMaterial color={type.color} roughness={0.7} metalness={0} />
        </mesh>
      );
  }
}

// ---------------------------------------------------------------------------
// Material shorthand components
// ---------------------------------------------------------------------------

function Chrome() {
  return <meshPhysicalMaterial color="#CDD2DA" roughness={0.08} metalness={1.0} clearcoat={0.6} clearcoatRoughness={0.08} />;
}
function Steel() {
  return <meshPhysicalMaterial color="#A8B0BA" roughness={0.4} metalness={0.88} />;
}
function DarkMetal() {
  return <meshPhysicalMaterial color="#252D3A" roughness={0.5} metalness={0.75} />;
}
function WoodMat() {
  return <meshPhysicalMaterial color="#B8824A" roughness={0.38} metalness={0.0} clearcoat={0.45} clearcoatRoughness={0.28} />;
}
function WoodDarkMat() {
  return <meshPhysicalMaterial color="#7A5330" roughness={0.55} metalness={0.0} clearcoat={0.2} clearcoatRoughness={0.4} />;
}
function LeatherMat() {
  return <meshPhysicalMaterial color="#8C6240" roughness={0.7} metalness={0.0} sheen={0.6} sheenRoughness={0.85} />;
}
function SuedeMat() {
  return <meshPhysicalMaterial color="#D4B07A" roughness={1.0} metalness={0.0} sheen={1.2} sheenRoughness={0.5} />;
}
function RedPad() {
  return <meshPhysicalMaterial color="#CC2020" roughness={0.8} metalness={0.0} />;
}

// ---------------------------------------------------------------------------
// Barr (Parallel bars)
// ---------------------------------------------------------------------------

function ParallelBars({ w, d }: { w: number; d: number }) {
  const railH1 = 1.7;
  const railH2 = 1.95;
  const railR = 0.025;
  const postR = 0.04;
  const baseH = 0.04;

  return (
    <group>
      {/* Bottenplatta */}
      <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, baseH, d]} />
        <DarkMetal />
      </mesh>

      {/* 4 vertikala chrome-stolpar */}
      {([-d * 0.4, d * 0.4] as number[]).flatMap((zOff) =>
        ([-w * 0.42, w * 0.42] as number[]).map((xOff, i) => (
          <mesh key={`${zOff}-${i}`} position={[xOff, railH2 / 2 + baseH, zOff]} castShadow>
            <cylinderGeometry args={[postR, postR * 1.1, railH2, 20]} />
            <Chrome />
          </mesh>
        )),
      )}

      {/* Räls – capsule (rundade ändar) i trä */}
      {[
        { z: -d * 0.4, h: railH1 + baseH },
        { z: d * 0.4, h: railH2 + baseH },
      ].map(({ z, h }, i) => (
        <mesh key={i} position={[0, h, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[railR, w - railR * 2, 6, 18]} />
          <WoodMat />
        </mesh>
      ))}

      {/* Horisontella tvärbalkar */}
      {([-d * 0.4, d * 0.4] as number[]).map((zOff, i) => (
        <mesh key={i} position={[0, baseH + 0.06, zOff]} castShadow>
          <boxGeometry args={[w * 0.88, 0.03, 0.04]} />
          <DarkMetal />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Räck (High bar)
// ---------------------------------------------------------------------------

function HighBar({ w, d }: { w: number; d: number }) {
  const barH = 2.75;
  const barR = 0.014;
  const postR = 0.048;
  const baseH = 0.05;
  const xPost = w * 0.45;

  return (
    <group>
      {/* Basen */}
      <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, baseH, d]} />
        <DarkMetal />
      </mesh>

      {/* Stolpar */}
      {([-xPost, xPost] as number[]).map((x, i) => (
        <mesh key={i} position={[x, barH / 2 + baseH, 0]} castShadow>
          <cylinderGeometry args={[postR, postR * 1.15, barH, 18]} />
          <Chrome />
        </mesh>
      ))}

      {/* Vajrar diagonalt */}
      {([-1, 1] as number[]).flatMap((sx) =>
        ([-1, 1] as number[]).map((sz) => {
          const from: [number, number, number] = [xPost * sx, barH * 0.85, 0];
          const to: [number, number, number] = [xPost * sx + sx * 0.55, baseH, sz * d * 0.42];
          const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
          const len = Math.hypot(dx, dy, dz);
          const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
          return (
            <mesh key={`${sx}-${sz}`} position={mid} rotation={[Math.atan2(Math.hypot(dx, dz), dy), Math.atan2(dx, dz), 0]} castShadow>
              <cylinderGeometry args={[0.006, 0.006, len, 6]} />
              <Steel />
            </mesh>
          );
        }),
      )}

      {/* Stången – tunn chrome */}
      <mesh position={[0, barH + baseH, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[barR, w - barR * 2, 6, 16]} />
        <Chrome />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bom (Balance beam)
// ---------------------------------------------------------------------------

function Beam({ w }: { w: number; d: number }) {
  // Tävlingsbom: 5 m lång, 10×10 cm tvärsnitt
  const beamH = 1.25;
  const baseH = 0.03;
  const beamW = 0.1; // bredd
  const beamD = 0.1; // djup (10 cm cross-section)

  return (
    <group>
      {/* Två röda kilformade stöd */}
      {([-w * 0.38, w * 0.38] as number[]).map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, beamH * 0.5, 0]} castShadow>
            <boxGeometry args={[0.12, beamH, 0.45]} />
            <RedPad />
          </mesh>
          <mesh position={[0, baseH / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.5, baseH, 0.55]} />
            <DarkMetal />
          </mesh>
        </group>
      ))}

      {/* Bomkropp – längs X-axeln (ingen rotation) */}
      <group position={[0, beamH + beamW / 2, 0]}>
        <RoundedBox args={[w, beamW, beamD]} radius={0.012} smoothness={4} castShadow>
          <LeatherMat />
        </RoundedBox>
        {/* Mocka-yta på toppen */}
        <mesh position={[0, beamW / 2 + 0.003, 0]} castShadow>
          <boxGeometry args={[w - 0.02, 0.005, beamD * 0.8]} />
          <SuedeMat />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bygelhäst (Pommel horse)
// ---------------------------------------------------------------------------

function PommelHorse({ w, d: _d }: { w: number; d: number }) {
  const standH = 0.78;
  const bodyH = 0.38;
  const bodyD = 0.42;

  return (
    <group>
      {/* 4 chrome-ben */}
      {([-w * 0.32, w * 0.32] as number[]).flatMap((x) =>
        ([-bodyD * 0.32, bodyD * 0.32] as number[]).map((z, i) => (
          <mesh key={`${x}-${i}`} position={[x, standH / 2, z]} castShadow>
            <cylinderGeometry args={[0.025, 0.032, standH, 14]} />
            <Chrome />
          </mesh>
        )),
      )}

      {/* Korsbalkar under */}
      {([-bodyD * 0.32, bodyD * 0.32] as number[]).map((z, i) => (
        <mesh key={i} position={[0, 0.08, z]} castShadow>
          <boxGeometry args={[w * 0.7, 0.025, 0.03]} />
          <DarkMetal />
        </mesh>
      ))}

      {/* Kropp – läder */}
      <group position={[0, standH + bodyH / 2, 0]}>
        <RoundedBox args={[w * 0.95, bodyH, bodyD]} radius={0.06} smoothness={5} castShadow>
          <LeatherMat />
        </RoundedBox>
      </group>

      {/* Byglar (pommels) – chrome halvcirklar */}
      {([-w * 0.2, w * 0.2] as number[]).map((x, i) => (
        <mesh key={i} position={[x, standH + bodyH + 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.09, 0.018, 14, 24, Math.PI]} />
          <Chrome />
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
      {/* Golvmarkering */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[Math.max(w, d) * 0.42, Math.max(w, d) * 0.48, 32]} />
        <meshPhysicalMaterial color="#8A9BAE" roughness={0.9} transparent opacity={0.35} metalness={0} />
      </mesh>

      {/* Ringar med remmar */}
      {([-0.28, 0.28] as number[]).map((dx, i) => (
        <group key={i} position={[dx, 0, 0]}>
          {/* Rem (läderrem) */}
          <mesh position={[0, ringY + strapH / 2 + ringR, 0]} castShadow>
            <boxGeometry args={[0.032, strapH, 0.012]} />
            <LeatherMat />
          </mesh>
          {/* Ring – chrome torus */}
          <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[ringR, ringT, 14, 32]} />
            <Chrome />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Hoppbord (Vault)
// ---------------------------------------------------------------------------

function Vault({ w, d }: { w: number; d: number }) {
  const standH = 0.98;
  const padH = 0.38;

  return (
    <group>
      {/* Central chrome-pelare */}
      <mesh position={[0, standH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.075, standH, 14]} />
        <Chrome />
      </mesh>
      {/* Bottenplatta */}
      <mesh position={[0, 0.02, 0]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.7, 0.04, d * 0.7]} />
        <DarkMetal />
      </mesh>
      {/* Hoppytan */}
      <group position={[0, standH + padH / 2, 0]}>
        <RoundedBox args={[w, padH, d]} radius={0.04} smoothness={4} castShadow>
          <LeatherMat />
        </RoundedBox>
        {/* Topplager */}
        <mesh position={[0, padH / 2 + 0.004, 0]} castShadow>
          <boxGeometry args={[w - 0.04, 0.008, d - 0.04]} />
          <SuedeMat />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trampett / Mini-tramp
// ---------------------------------------------------------------------------

function Trampette({ w, d }: { w: number; d: number }) {
  const frameH = 0.28;
  const tilt = 0.15;
  const bedW = w * 0.84;
  const bedD = d * 0.84;

  return (
    <group rotation={[-tilt, 0, 0]} position={[0, frameH * 0.6, 0]}>
      {/* Ram */}
      <mesh castShadow>
        <boxGeometry args={[w, frameH * 0.35, d]} />
        <DarkMetal />
      </mesh>
      {/* Studsyta */}
      <mesh position={[0, frameH * 0.19, 0]} castShadow>
        <boxGeometry args={[bedW, 0.018, bedD]} />
        <meshPhysicalMaterial color="#B82020" roughness={0.72} metalness={0} />
      </mesh>
      {/* Fjädrar runt kanten */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * w * 0.42, frameH * 0.1, Math.sin(angle) * d * 0.42]} castShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.12, 5]} />
            <Steel />
          </mesh>
        );
      })}
      {/* Fötter */}
      {([[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]] as [number, number][]).map(([px, pz], i) => (
        <mesh key={i} position={[px, -frameH * 0.5, pz]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, frameH * 0.4, 8]} />
          <DarkMetal />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tumblingbana
// ---------------------------------------------------------------------------

function Track({ w, d, h }: { w: number; d: number; h: number }) {
  const th = Math.max(0.08, h);
  return (
    <group>
      <RoundedBox args={[w, th, d]} radius={0.03} smoothness={3} position={[0, th / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#4A7A3A" roughness={0.85} metalness={0} />
      </RoundedBox>
      {/* Vita sidolinjer */}
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

function AirTrack({ w, d }: { w: number; d: number }) {
  const h = 0.28;
  return (
    <group>
      <mesh position={[0, h / 2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <capsuleGeometry args={[h / 2, w - h, 8, 20]} />
        <meshPhysicalMaterial color="#2878C0" roughness={0.5} metalness={0} clearcoat={0.35} clearcoatRoughness={0.3} />
      </mesh>
      {/* Logotyp-rand */}
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

function Floor({ w, d }: { w: number; d: number }) {
  const h = 0.08;
  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={0.02} smoothness={3} position={[0, h / 2, 0]} receiveShadow castShadow>
        <meshPhysicalMaterial color="#7AAE7E" roughness={0.9} metalness={0} />
      </RoundedBox>
      {/* Vit kantlinje */}
      <mesh position={[0, h + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[Math.min(w, d) * 0.44, Math.min(w, d) * 0.47, 4, 1]} />
        <meshPhysicalMaterial color="#FFFFFF" roughness={0.4} metalness={0} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tjockmatta
// ---------------------------------------------------------------------------

function ThickMat({ w, d, h }: { w: number; d: number; h: number }) {
  const th = Math.max(0.12, h);
  return (
    <RoundedBox args={[w, th, d]} radius={0.04} smoothness={4} position={[0, th / 2, 0]} castShadow receiveShadow>
      <meshPhysicalMaterial color="#2A60A0" roughness={0.75} metalness={0} />
    </RoundedBox>
  );
}

// ---------------------------------------------------------------------------
// Landningsmatta
// ---------------------------------------------------------------------------

function LandingMat({ w, d, h }: { w: number; d: number; h: number }) {
  const th = Math.max(0.06, h);
  return (
    <RoundedBox args={[w, th, d]} radius={0.03} smoothness={3} position={[0, th / 2, 0]} castShadow receiveShadow>
      <meshPhysicalMaterial color="#CC7020" roughness={0.78} metalness={0} />
    </RoundedBox>
  );
}

// ---------------------------------------------------------------------------
// Plint
// ---------------------------------------------------------------------------

function Plinth({ w, d, h }: { w: number; d: number; h: number }) {
  const layers = 4;
  const layerH = h / layers;
  return (
    <group>
      {Array.from({ length: layers }).map((_, i) => {
        const shrink = 1 - i * 0.035;
        const isTop = i === layers - 1;
        return (
          <group key={i} position={[0, layerH * (i + 0.5), 0]}>
            <RoundedBox args={[w * shrink, layerH * 0.94, d * shrink]} radius={0.01} smoothness={3} castShadow receiveShadow>
              {isTop ? <LeatherMat /> : <WoodDarkMat />}
            </RoundedBox>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bock
// ---------------------------------------------------------------------------

function Buck({ w, d, h }: { w: number; d: number; h: number }) {
  const bodyH = h - 0.18;
  return (
    <group>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.048, 0.065, bodyH, 12]} />
        <Chrome />
      </mesh>
      <mesh position={[0, bodyH, 0]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.55, 0.02, d * 0.7]} />
        <DarkMetal />
      </mesh>
      <mesh position={[0, h - 0.08, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.14, Math.max(0.3, w * 0.65), 8, 18]} />
        <LeatherMat />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Skumgrop
// ---------------------------------------------------------------------------

function FoamPit({ w, d }: { w: number; d: number }) {
  const wallH = 0.75;
  const foamColors = ["#5090C8", "#4880B8", "#3A70A8", "#60A0D8"];
  return (
    <group position={[0, -0.05, 0]}>
      {/* Gropväggar */}
      <mesh position={[0, -wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, wallH, d]} />
        <meshPhysicalMaterial color="#2A3A28" roughness={0.85} metalness={0} />
      </mesh>
      {/* Skumklossar */}
      {Array.from({ length: 6 }).flatMap((_, ix) =>
        Array.from({ length: 5 }).map((_, iz) => {
          const cellW = w / 6;
          const cellD = d / 5;
          const px = -w / 2 + cellW * (ix + 0.5);
          const pz = -d / 2 + cellD * (iz + 0.5);
          const rotY = (ix * 17 + iz * 11) * 0.08;
          const colorIdx = (ix + iz) % foamColors.length;
          return (
            <mesh key={`${ix}-${iz}`} position={[px, -0.06, pz]} rotation={[0, rotY, 0]} castShadow>
              <boxGeometry args={[cellW * 0.82, 0.22, cellD * 0.82]} />
              <meshPhysicalMaterial color={foamColors[colorIdx]} roughness={0.9} metalness={0} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}
