/**
 * GymnastBody – delad FK-rigg för alla gymnast-renderingar.
 *
 * KONVENTION (VIKTIG – all övnings-choreografi antar detta):
 *   • ROOT    = höfterna
 *   • Bålen sträcker sig UPPÅT, benen NEDÅT
 *   • Ansiktet (ögon/näsa/mun) + tåspetsarna pekar mot lokal −Z ("framåt")
 *   • Hårknut / hästsvans sitter på +Z-sidan av huvudet (bakåt)
 *   • +X = höger, −X = vänster, +Y = upp
 *
 * Ledkedja:
 *   rootRef → spineRef → headRef
 *                     → lShRef → lElRef
 *                     → rShRef → rElRef
 *          → lHipRef → lKnRef
 *          → rHipRef → rKnRef
 */
import { forwardRef } from "react";
import * as THREE from "three";

// ─── Proportioner (meter) ─────────────────────────────────────────────────────
export const H_HEAD  = 0.09;
export const H_NECK  = 0.09;
export const H_TORSO = 0.46;
export const H_UPPER = 0.27;
export const H_LOWER = 0.24;
export const H_THIGH = 0.38;
export const H_SHIN  = 0.35;
export const R_BODY  = 0.068;
export const R_LIMB  = 0.036;
export const R_LEG   = 0.046;
export const W_SHLDR = 0.19;
export const W_HIP   = 0.11;

// Avstånd höft → hand när armarna är sträckta rakt upp
export const HANG_DIST = H_TORSO * 0.85 + H_UPPER + H_LOWER;

const P = Math.PI;

// ─── Bål-profil för LatheGeometry ─────────────────────────────────────────────
// (radius, height) sett från sidan. Roteras runt Y-axeln vid render.
// Kvinnlig kontur: bred höft → smal midja → bredare bröstkorg → smal hals.
// Stängd vid topp och botten (x=0.001) så det inte syns hål in i bålen.
const TORSO_PROFILE: THREE.Vector2[] = [
  new THREE.Vector2(0.001,        0.00 * H_TORSO),  // stängd botten
  new THREE.Vector2(0.95 * R_BODY, 0.005 * H_TORSO),
  new THREE.Vector2(1.06 * R_BODY, 0.10 * H_TORSO), // bredaste höft
  new THREE.Vector2(0.95 * R_BODY, 0.20 * H_TORSO),
  new THREE.Vector2(0.74 * R_BODY, 0.36 * H_TORSO), // smalaste midja
  new THREE.Vector2(0.82 * R_BODY, 0.50 * H_TORSO),
  new THREE.Vector2(1.00 * R_BODY, 0.65 * H_TORSO),
  new THREE.Vector2(1.10 * R_BODY, 0.78 * H_TORSO), // bredaste bröstkorg
  new THREE.Vector2(1.02 * R_BODY, 0.88 * H_TORSO),
  new THREE.Vector2(0.45 * R_BODY, 0.96 * H_TORSO),
  new THREE.Vector2(0.001,        1.00 * H_TORSO),  // stängd topp (möter halsen)
];

// ─── Refs ─────────────────────────────────────────────────────────────────────
export type BodyRefs = {
  spineRef: React.RefObject<THREE.Group | null>;
  headRef:  React.RefObject<THREE.Group | null>;
  lShRef:   React.RefObject<THREE.Group | null>;
  lElRef:   React.RefObject<THREE.Group | null>;
  rShRef:   React.RefObject<THREE.Group | null>;
  rElRef:   React.RefObject<THREE.Group | null>;
  lHipRef:  React.RefObject<THREE.Group | null>;
  lKnRef:   React.RefObject<THREE.Group | null>;
  rHipRef:  React.RefObject<THREE.Group | null>;
  rKnRef:   React.RefObject<THREE.Group | null>;
};

// R3F:s ref-prop vill ha Ref<T> (utan null). Denna cast tillåter det.
function r3f<T>(ref: React.RefObject<T | null>): React.Ref<T> {
  return ref as React.Ref<T>;
}

// ─── Primitiver ───────────────────────────────────────────────────────────────
function LeotardSeg({ len, r, color, up = false }: {
  len: number; r: number; color: string; up?: boolean;
}) {
  return (
    <mesh position={[0, up ? len / 2 : -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - r * 2), 6, 10]} />
      <meshPhysicalMaterial color={color} roughness={0.48} metalness={0.05}
        clearcoat={0.35} clearcoatRoughness={0.30} />
    </mesh>
  );
}
function SkinSeg({ len, r, color, up = false }: {
  len: number; r: number; color: string; up?: boolean;
}) {
  return (
    <mesh position={[0, up ? len / 2 : -len / 2, 0]} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - r * 2), 6, 10]} />
      <meshPhysicalMaterial color={color} roughness={0.72} metalness={0} />
    </mesh>
  );
}
function Joint({ r, color, leotard = false }: {
  r: number; color: string; leotard?: boolean;
}) {
  return (
    <mesh castShadow>
      <sphereGeometry args={[r, 10, 8]} />
      <meshPhysicalMaterial color={color} roughness={leotard ? 0.48 : 0.72}
        metalness={leotard ? 0.05 : 0}
        clearcoat={leotard ? 0.35 : 0} clearcoatRoughness={0.30} />
    </mesh>
  );
}

// ─── Huvud – ansiktsdetaljer mot −Z ───────────────────────────────────────────
function Head({ skin, hair, ribbon = "#ff6fa0" }: {
  skin: string; hair: string; ribbon?: string;
}) {
  // Använd `skin` som bas och blanda till en något varmare ton i ansiktet
  const skinWarm = skin || "#f2d1ae";
  return (
    <>
      {/* Huvud – lätt ovalt via icke-uniform skala */}
      <mesh castShadow scale={[1.0, 1.08, 1.02]}>
        <sphereGeometry args={[H_HEAD, 24, 18]} />
        <meshPhysicalMaterial color={skinWarm} roughness={0.55} metalness={0} clearcoat={0.08} clearcoatRoughness={0.6} />
      </mesh>

      {/* ── Hår ───────────────────────────────────────────────────────
          Tre delar, samma centrum, utan överlapp som skapar synliga sömmar:
           1) Skullcap (topp + panna ovanför ögonbrynen) – full phi, thetaLength≈0.45π
           2) Bak/sidor ned mot nacken – phi-glapp 90° mot −Z (ansikte), theta
              börjar där skullcap slutar, slutar vid hakans nivå (ej under)
           3) Pannlugg (snedlugg) – liten asymmetrisk bulle över pannan

          Three.js phi-konvention:
           • x = −r·cos(phi)·sin(theta),  z = r·sin(phi)·sin(theta)
           • phi=0 → −X,  π/2 → +Z,  π → +X,  3π/2 → −Z (ansikte)
          Ansiktsglapp: phi ∈ [5π/4, 7π/4] (90° runt −Z) ⇒ hårets phiStart=7π/4,
          phiLength=3π/2 sveper −X → +Z → +X och lämnar ansiktet fritt. */}

      {/* 1) Skullcap – ENDAST hjässan, slutar precis ovan pannan på framsidan.
             thetaLength=0.32π (~58°) → fronten (−Z) når ned till ca y=0.05·H_HEAD
             (strax ovan ögonbrynen), inte ner över ögonen. */}
      <mesh position={[0, 0, H_HEAD * 0.02]} castShadow scale={[1.05, 1.06, 1.07]}>
        <sphereGeometry args={[H_HEAD * 1.01, 32, 18, 0, P * 2, 0, P * 0.32]} />
        <meshPhysicalMaterial color={hair} roughness={0.72} metalness={0.06}
          clearcoat={0.35} clearcoatRoughness={0.30} />
      </mesh>

      {/* 2) Bak + sidor – tar vid där skullcap slutar och täcker nacken/sidorna.
             90° ansiktsglapp så face (−Z) inte täcks. Något innanför skullcap för
             att undvika z-fighting i överlappet (theta 0.30π→0.32π). */}
      <mesh position={[0, 0, H_HEAD * 0.03]} castShadow scale={[1.05, 1.06, 1.08]}>
        <sphereGeometry args={[H_HEAD * 1.005, 36, 22, P * 1.75, P * 1.5, P * 0.30, P * 0.45]} />
        <meshPhysicalMaterial color={hair} roughness={0.72} metalness={0.06}
          clearcoat={0.35} clearcoatRoughness={0.30} />
      </mesh>

      {/* 3) Snedlugg – liten bulle som bryter hårlinjen över pannan */}
      <mesh position={[-H_HEAD * 0.10, H_HEAD * 0.34, -H_HEAD * 0.80]}
            rotation={[P * 0.22, P * 0.04, P * 0.05]} castShadow scale={[1.6, 0.38, 0.75]}>
        <sphereGeometry args={[H_HEAD * 0.34, 16, 12]} />
        <meshPhysicalMaterial color={hair} roughness={0.72} metalness={0.06}
          clearcoat={0.35} clearcoatRoughness={0.30} />
      </mesh>

      {/* Hårknut (bun) – placerad i nacken, mindre och mer kompakt */}
      <mesh position={[0, H_HEAD * 0.15, H_HEAD * 1.08]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.42, 20, 16]} />
        <meshPhysicalMaterial color={hair} roughness={0.78} metalness={0.05}
          clearcoat={0.35} clearcoatRoughness={0.30} />
      </mesh>
      {/* Hårband runt knuten */}
      <mesh position={[0, H_HEAD * 0.15, H_HEAD * 1.02]} rotation={[P * 0.5, 0, 0]} castShadow>
        <torusGeometry args={[H_HEAD * 0.36, 0.010, 8, 20]} />
        <meshPhysicalMaterial color={ribbon} roughness={0.40} metalness={0.15} clearcoat={0.6} />
      </mesh>
      {/* Rosett-sidor (små öglor) */}
      <mesh position={[-H_HEAD * 0.36, H_HEAD * 0.22, H_HEAD * 1.00]} rotation={[0, 0, -P * 0.25]} castShadow>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshPhysicalMaterial color={ribbon} roughness={0.45} metalness={0.08} />
      </mesh>
      <mesh position={[ H_HEAD * 0.36, H_HEAD * 0.22, H_HEAD * 1.00]} rotation={[0, 0, P * 0.25]} castShadow>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshPhysicalMaterial color={ribbon} roughness={0.45} metalness={0.08} />
      </mesh>

      {/* Öron – tätare mot huvudet, något mindre */}
      <mesh position={[-H_HEAD * 0.86, -H_HEAD * 0.08, H_HEAD * 0.10]} rotation={[0, P * 0.1, 0]} scale={[0.5, 0.95, 1.15]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.13, 10, 8]} />
        <meshPhysicalMaterial color={skinWarm} roughness={0.60} metalness={0} />
      </mesh>
      <mesh position={[ H_HEAD * 0.86, -H_HEAD * 0.08, H_HEAD * 0.10]} rotation={[0, -P * 0.1, 0]} scale={[0.5, 0.95, 1.15]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.13, 10, 8]} />
        <meshPhysicalMaterial color={skinWarm} roughness={0.60} metalness={0} />
      </mesh>

      {/* ── Ansikte (−Z) ─────────────────────────────────────────────── */}

      {/* Ögonvitor */}
      <mesh position={[-H_HEAD * 0.34, H_HEAD * 0.08, -H_HEAD * 0.88]} castShadow>
        <sphereGeometry args={[0.016, 12, 8]} />
        <meshPhysicalMaterial color="#fafafa" roughness={0.2} metalness={0} />
      </mesh>
      <mesh position={[ H_HEAD * 0.34, H_HEAD * 0.08, -H_HEAD * 0.88]} castShadow>
        <sphereGeometry args={[0.016, 12, 8]} />
        <meshPhysicalMaterial color="#fafafa" roughness={0.2} metalness={0} />
      </mesh>

      {/* Iris – varm brun */}
      <mesh position={[-H_HEAD * 0.34, H_HEAD * 0.08, -H_HEAD * 0.895]} castShadow>
        <sphereGeometry args={[0.011, 10, 8]} />
        <meshPhysicalMaterial color="#5a3a1a" roughness={0.25} metalness={0.2} clearcoat={0.8} clearcoatRoughness={0.15} />
      </mesh>
      <mesh position={[ H_HEAD * 0.34, H_HEAD * 0.08, -H_HEAD * 0.895]} castShadow>
        <sphereGeometry args={[0.011, 10, 8]} />
        <meshPhysicalMaterial color="#5a3a1a" roughness={0.25} metalness={0.2} clearcoat={0.8} clearcoatRoughness={0.15} />
      </mesh>

      {/* Pupiller */}
      <mesh position={[-H_HEAD * 0.34, H_HEAD * 0.08, -H_HEAD * 0.905]} castShadow>
        <sphereGeometry args={[0.005, 8, 6]} />
        <meshPhysicalMaterial color="#0a0a0a" roughness={0.15} metalness={0.3} />
      </mesh>
      <mesh position={[ H_HEAD * 0.34, H_HEAD * 0.08, -H_HEAD * 0.905]} castShadow>
        <sphereGeometry args={[0.005, 8, 6]} />
        <meshPhysicalMaterial color="#0a0a0a" roughness={0.15} metalness={0.3} />
      </mesh>

      {/* Ljusreflex i ögon – liten vit prick uppe till vänster */}
      <mesh position={[-H_HEAD * 0.31, H_HEAD * 0.12, -H_HEAD * 0.905]}>
        <sphereGeometry args={[0.0026, 6, 5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[ H_HEAD * 0.37, H_HEAD * 0.12, -H_HEAD * 0.905]}>
        <sphereGeometry args={[0.0026, 6, 5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Ögonfransar – tunn mörk båge precis ovanför ögat */}
      <mesh position={[-H_HEAD * 0.34, H_HEAD * 0.135, -H_HEAD * 0.88]} rotation={[P * 0.5, 0, 0]} castShadow>
        <torusGeometry args={[0.013, 0.0014, 6, 10, P * 0.9]} />
        <meshPhysicalMaterial color="#1a0f06" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[ H_HEAD * 0.34, H_HEAD * 0.135, -H_HEAD * 0.88]} rotation={[P * 0.5, 0, 0]} castShadow>
        <torusGeometry args={[0.013, 0.0014, 6, 10, P * 0.9]} />
        <meshPhysicalMaterial color="#1a0f06" roughness={0.55} metalness={0.1} />
      </mesh>

      {/* Ögonbryn – två TUNNA, horisontella streck ovanför respektive öga.
          Capsule ligger längs Y-axeln, så vi roterar π/2 kring Z för att
          få den horisontell. Liten arch via Z-tilt (±0.05π). */}
      <mesh position={[-H_HEAD * 0.34, H_HEAD * 0.22, -H_HEAD * 0.87]}
            rotation={[P * 0.08, 0, P * 0.5 - P * 0.05]} castShadow>
        <capsuleGeometry args={[0.0020, 0.018, 3, 6]} />
        <meshPhysicalMaterial color={hair} roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh position={[ H_HEAD * 0.34, H_HEAD * 0.22, -H_HEAD * 0.87]}
            rotation={[P * 0.08, 0, P * 0.5 + P * 0.05]} castShadow>
        <capsuleGeometry args={[0.0020, 0.018, 3, 6]} />
        <meshPhysicalMaterial color={hair} roughness={0.78} metalness={0.04} />
      </mesh>

      {/* Näsa – liten kon/kil */}
      <mesh position={[0, -H_HEAD * 0.05, -H_HEAD * 0.97]} rotation={[P * 0.18, 0, 0]} castShadow>
        <coneGeometry args={[0.014, 0.036, 10]} />
        <meshPhysicalMaterial color={skinWarm} roughness={0.60} metalness={0} />
      </mesh>

      {/* Mun – mjukt leende (liten båge) */}
      <mesh position={[0, -H_HEAD * 0.30, -H_HEAD * 0.92]} rotation={[P * 0.5, 0, 0]} castShadow>
        <torusGeometry args={[0.020, 0.005, 8, 14, P * 0.7]} />
        <meshPhysicalMaterial color="#c24a55" roughness={0.40} metalness={0.05} clearcoat={0.5} clearcoatRoughness={0.2} />
      </mesh>

      {/* Kinder – subtilt rosa */}
      <mesh position={[-H_HEAD * 0.62, -H_HEAD * 0.15, -H_HEAD * 0.66]}>
        <sphereGeometry args={[0.013, 10, 8]} />
        <meshPhysicalMaterial color="#f5a5b5" roughness={0.80} metalness={0} transparent opacity={0.50} />
      </mesh>
      <mesh position={[ H_HEAD * 0.62, -H_HEAD * 0.15, -H_HEAD * 0.66]}>
        <sphereGeometry args={[0.013, 10, 8]} />
        <meshPhysicalMaterial color="#f5a5b5" roughness={0.80} metalness={0} transparent opacity={0.50} />
      </mesh>
    </>
  );
}

// ─── Hand – liten knutnäve med synlig tumme ───────────────────────────────────
function Hand({ skin }: { skin: string }) {
  return (
    <group position={[0, -0.005, 0]}>
      {/* Handflata */}
      <mesh castShadow>
        <sphereGeometry args={[0.028, 12, 10]} />
        <meshPhysicalMaterial color={skin} roughness={0.66} metalness={0} />
      </mesh>
      {/* Tumme – liten kapsel nedåt-framåt */}
      <mesh position={[0, -0.018, -0.020]} rotation={[P * 0.35, 0, 0]} castShadow>
        <capsuleGeometry args={[0.009, 0.020, 4, 6]} />
        <meshPhysicalMaterial color={skin} roughness={0.66} metalness={0} />
      </mesh>
      {/* Knoge-slinga (suggererar fingrar) */}
      <mesh position={[0, -0.022, 0.008]} rotation={[-P * 0.1, 0, 0]} castShadow>
        <capsuleGeometry args={[0.012, 0.018, 4, 6]} />
        <meshPhysicalMaterial color={skin} roughness={0.66} metalness={0} />
      </mesh>
    </group>
  );
}

// ─── Fot – barfota, tåspetsar mot −Z ──────────────────────────────────────────
// Placeras i lKn/rKn-frame. Knät roterar shin+fot runt X,
// så foten följer alltid underbenet.
function Foot({ skin }: { skin: string }) {
  return (
    <group position={[0, -H_SHIN, 0]}>
      {/* Ankelled */}
      <mesh castShadow>
        <sphereGeometry args={[0.026, 12, 10]} />
        <meshPhysicalMaterial color={skin} roughness={0.70} metalness={0} />
      </mesh>
      {/* Fotblad – välvd kapsel framåt-nedåt */}
      <mesh position={[0, -0.026, -0.040]} rotation={[P * 0.40, 0, 0]} castShadow>
        <capsuleGeometry args={[0.022, 0.062, 6, 10]} />
        <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
      </mesh>
      {/* Häl */}
      <mesh position={[0, -0.028, 0.008]} castShadow>
        <sphereGeometry args={[0.022, 10, 8]} />
        <meshPhysicalMaterial color={skin} roughness={0.72} metalness={0} />
      </mesh>
      {/* Tå-paket – liten rundad klump längst fram */}
      <mesh position={[0, -0.040, -0.075]} castShadow>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshPhysicalMaterial color={skin} roughness={0.66} metalness={0} />
      </mesh>
    </group>
  );
}

// ─── Huvud-komponent ──────────────────────────────────────────────────────────
type Props = {
  color: string;
  skin: string;
  hair: string;
  refs: BodyRefs;
};

export const GymnastBody = forwardRef<THREE.Group, Props>(function GymnastBody(
  { color, skin, hair, refs },
  ref,
) {
  return (
    <group ref={ref}>
      {/* Höftkula */}
      <Joint r={0.062} color={color} leotard />

      {/* ── Bål (uppåt från höfter) ──────────────────────────────────── */}
      <group ref={r3f(refs.spineRef)}>
        {/* Bål – ENDA mjuk lathe-profil ersätter de tre cylindrarna.
            Smal midja, bred höft, bredare bröstkorg, mot smal hals. */}
        <mesh castShadow>
          <latheGeometry args={[TORSO_PROFILE, 28]} />
          <meshPhysicalMaterial color={color} roughness={0.35} metalness={0.18}
            clearcoat={0.55} clearcoatRoughness={0.22} />
        </mesh>

        {/* Diskret bystantydning – placerade på bröstkorgens topp (y≈0.72) på
            framsidan, just utanför torso-profilen så de syns men inte poppar. */}
        {([-1, 1] as number[]).map((side) => (
          <mesh key={`bust-${side}`}
                position={[side * R_BODY * 0.45, H_TORSO * 0.72, -R_BODY * 1.02]}
                scale={[1.0, 0.95, 0.55]} castShadow>
            <sphereGeometry args={[R_BODY * 0.24, 14, 10]} />
            <meshPhysicalMaterial color={color} roughness={0.38} metalness={0.16}
              clearcoat={0.55} clearcoatRoughness={0.22} />
          </mesh>
        ))}

        {/* Axel-yoke – mjukare och tjockare än tidigare (skala Y 0.55→0.80 gör
            det mindre tallrikslikt, X 3.05→2.55 gör det mindre utstickande). */}
        <mesh position={[0, H_TORSO * 0.90, 0]} scale={[2.55, 0.80, 1.20]} castShadow>
          <sphereGeometry args={[R_BODY * 0.95, 26, 18]} />
          <meshPhysicalMaterial color={color} roughness={0.38} metalness={0.16}
            clearcoat={0.50} clearcoatRoughness={0.25} />
        </mesh>

        {/* Hals */}
        <group position={[0, H_TORSO + 0.005, 0]}>
          <SkinSeg len={H_NECK} r={0.028} color={skin} up />
        </group>

        {/* Huvud */}
        <group ref={r3f(refs.headRef)} position={[0, H_TORSO + H_NECK + H_HEAD * 0.90, 0]}>
          <Head skin={skin} hair={hair} />
        </group>

        {/* Axelkulor – mindre, smälter in med klavikelbryggan */}
        {([-W_SHLDR, W_SHLDR] as number[]).map((x, i) => (
          <mesh key={i} position={[x, H_TORSO * 0.88, 0]} castShadow>
            <sphereGeometry args={[0.044, 14, 11]} />
            <meshPhysicalMaterial color={color} roughness={0.40} metalness={0.14}
              clearcoat={0.50} clearcoatRoughness={0.25} />
          </mesh>
        ))}

        {/* Vänster arm */}
        <group ref={r3f(refs.lShRef)} position={[-W_SHLDR, H_TORSO * 0.87, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB * 1.05} color={color} />
          <group ref={r3f(refs.lElRef)} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 0.96} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.88} color={skin} />
            <group position={[0, -H_LOWER, 0]}>
              <Hand skin={skin} />
            </group>
          </group>
        </group>

        {/* Höger arm */}
        <group ref={r3f(refs.rShRef)} position={[W_SHLDR, H_TORSO * 0.87, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB * 1.05} color={color} />
          <group ref={r3f(refs.rElRef)} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 0.96} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.88} color={skin} />
            <group position={[0, -H_LOWER, 0]}>
              <Hand skin={skin} />
            </group>
          </group>
        </group>
      </group>

      {/* ── Vänster ben – barfota, hög benskärning på leotard ────────── */}
      <group ref={r3f(refs.lHipRef)} position={[-W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        {/* Hög benskärning – tunn hud-ring där leotard slutar */}
        <mesh position={[0, -0.012, 0]} rotation={[0, 0, P * 0.5]} castShadow>
          <torusGeometry args={[R_LEG * 1.04, 0.004, 8, 18]} />
          <meshPhysicalMaterial color={skin} roughness={0.62} metalness={0} />
        </mesh>
        <group ref={r3f(refs.lKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 0.96} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          <Foot skin={skin} />
        </group>
      </group>

      {/* ── Höger ben – barfota, hög benskärning på leotard ─────────── */}
      <group ref={r3f(refs.rHipRef)} position={[W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        <mesh position={[0, -0.012, 0]} rotation={[0, 0, P * 0.5]} castShadow>
          <torusGeometry args={[R_LEG * 1.04, 0.004, 8, 18]} />
          <meshPhysicalMaterial color={skin} roughness={0.62} metalness={0} />
        </mesh>
        <group ref={r3f(refs.rKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 0.96} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          <Foot skin={skin} />
        </group>
      </group>
    </group>
  );
});
