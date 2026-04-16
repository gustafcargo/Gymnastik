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
  // Något ljusare hy på ansikte och örsnibbar
  const skinWarm = "#f2d1ae";
  return (
    <>
      {/* Huvud – lätt ovalt via icke-uniform skala */}
      <mesh castShadow scale={[1.0, 1.08, 1.02]}>
        <sphereGeometry args={[H_HEAD, 24, 18]} />
        <meshPhysicalMaterial color={skinWarm} roughness={0.55} metalness={0} clearcoat={0.08} clearcoatRoughness={0.6} />
      </mesh>

      {/* Hårkalott – mjuk volym som täcker ovansidan och gränsar mot pannan */}
      <mesh position={[0, H_HEAD * 0.18, H_HEAD * 0.05]} castShadow scale={[1.02, 1.0, 1.05]}>
        <sphereGeometry args={[H_HEAD * 0.94, 24, 18]} />
        <meshPhysicalMaterial color={hair} roughness={0.72} metalness={0.06}
          clearcoat={0.35} clearcoatRoughness={0.30} />
      </mesh>
      {/* Pannlugg – bred liten kalott strax ovanför pannan */}
      <mesh position={[0, H_HEAD * 0.22, -H_HEAD * 0.55]} rotation={[P * 0.10, 0, 0]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.52, 16, 12, 0, P * 2, 0, P * 0.55]} />
        <meshPhysicalMaterial color={hair} roughness={0.72} metalness={0.06}
          clearcoat={0.35} clearcoatRoughness={0.30} />
      </mesh>
      {/* Bakhuvud / nacke – täcker occipital */}
      <mesh position={[0, -H_HEAD * 0.06, H_HEAD * 0.58]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.66, 16, 12]} />
        <meshPhysicalMaterial color={hair} roughness={0.74} metalness={0.06} />
      </mesh>

      {/* Hårknut (bun) i bakhuvudet – klassisk gymnast-look */}
      <mesh position={[0, H_HEAD * 0.25, H_HEAD * 1.02]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.38, 18, 14]} />
        <meshPhysicalMaterial color={hair} roughness={0.78} metalness={0.05}
          clearcoat={0.35} clearcoatRoughness={0.30} />
      </mesh>
      {/* Rosett runt hårknuten */}
      <mesh position={[0, H_HEAD * 0.06, H_HEAD * 0.88]} rotation={[0, 0, 0]} castShadow>
        <torusGeometry args={[H_HEAD * 0.30, 0.012, 8, 18]} />
        <meshPhysicalMaterial color={ribbon} roughness={0.45} metalness={0.08} clearcoat={0.4} />
      </mesh>
      {/* Rosett-sidor (små öglor) */}
      <mesh position={[-H_HEAD * 0.32, H_HEAD * 0.30, H_HEAD * 0.92]} rotation={[0, 0, -P * 0.25]} castShadow>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshPhysicalMaterial color={ribbon} roughness={0.45} metalness={0.08} />
      </mesh>
      <mesh position={[ H_HEAD * 0.32, H_HEAD * 0.30, H_HEAD * 0.92]} rotation={[0, 0, P * 0.25]} castShadow>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshPhysicalMaterial color={ribbon} roughness={0.45} metalness={0.08} />
      </mesh>

      {/* Öron */}
      <mesh position={[-H_HEAD * 0.94, -H_HEAD * 0.05, H_HEAD * 0.05]} rotation={[0, P * 0.08, 0]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.22, 10, 8]} />
        <meshPhysicalMaterial color={skinWarm} roughness={0.60} metalness={0} />
      </mesh>
      <mesh position={[ H_HEAD * 0.94, -H_HEAD * 0.05, H_HEAD * 0.05]} rotation={[0, -P * 0.08, 0]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.22, 10, 8]} />
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

      {/* Ögonbryn – lätta torusbitar ovanför ögonen */}
      <mesh position={[-H_HEAD * 0.34, H_HEAD * 0.23, -H_HEAD * 0.85]} rotation={[P * 0.12, 0, -P * 0.05]} castShadow>
        <capsuleGeometry args={[0.004, 0.024, 3, 6]} />
        <meshPhysicalMaterial color={hair} roughness={0.78} metalness={0.04} />
      </mesh>
      <mesh position={[ H_HEAD * 0.34, H_HEAD * 0.23, -H_HEAD * 0.85]} rotation={[P * 0.12, 0, P * 0.05]} castShadow>
        <capsuleGeometry args={[0.004, 0.024, 3, 6]} />
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
        {/* Torso – avsmalnande cylinder (bredare axlar, smalare midja) */}
        <mesh position={[0, H_TORSO * 0.5, 0]} castShadow>
          <cylinderGeometry args={[R_BODY * 0.82, R_BODY * 1.02, H_TORSO, 20]} />
          <meshPhysicalMaterial color={color} roughness={0.35} metalness={0.18}
            clearcoat={0.55} clearcoatRoughness={0.22} />
        </mesh>

        {/* Midjeband – mörkare accent */}
        <mesh position={[0, H_TORSO * 0.36, 0]} castShadow>
          <torusGeometry args={[R_BODY * 1.00, 0.006, 10, 24]} />
          <meshPhysicalMaterial color={color} roughness={0.25} metalness={0.4} clearcoat={0.8} />
        </mesh>

        {/* Glittrig diagonalband över bålen (från vänster axel nedåt höger midja) */}
        <mesh position={[0, H_TORSO * 0.60, -R_BODY * 0.92]} rotation={[0, 0, P * 0.32]} castShadow>
          <planeGeometry args={[0.22, 0.018]} />
          <meshPhysicalMaterial color="#ffffff" roughness={0.15} metalness={0.7}
            clearcoat={1.0} clearcoatRoughness={0.05} side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>

        {/* Leotard-urringning (sweet-heart-form) – liten kapsel fram på bröstet (−Z) */}
        <mesh position={[0, H_TORSO * 0.92, -R_BODY * 0.82]} rotation={[P * 0.22, 0, 0]} castShadow>
          <capsuleGeometry args={[0.009, 0.072, 4, 8]} />
          <meshPhysicalMaterial color={skin} roughness={0.58} metalness={0} />
        </mesh>

        {/* Axelremmar – två smala band upp över axlarna */}
        {([-1, 1] as number[]).map((side) => (
          <mesh key={side}
                position={[side * R_BODY * 0.45, H_TORSO * 0.96, 0]}
                rotation={[0, 0, side * P * 0.04]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.10, 10]} />
            <meshPhysicalMaterial color={color} roughness={0.35} metalness={0.18}
              clearcoat={0.55} clearcoatRoughness={0.22} />
          </mesh>
        ))}

        {/* Hals */}
        <group position={[0, H_TORSO + 0.005, 0]}>
          <SkinSeg len={H_NECK} r={0.028} color={skin} up />
        </group>

        {/* Huvud */}
        <group ref={r3f(refs.headRef)} position={[0, H_TORSO + H_NECK + H_HEAD * 0.90, 0]}>
          <Head skin={skin} hair={hair} />
        </group>

        {/* Axelkulor */}
        {([-W_SHLDR, W_SHLDR] as number[]).map((x, i) => (
          <mesh key={i} position={[x, H_TORSO * 0.87, 0]} castShadow>
            <sphereGeometry args={[0.052, 12, 10]} />
            <meshPhysicalMaterial color={color} roughness={0.48} metalness={0.05}
              clearcoat={0.35} clearcoatRoughness={0.30} />
          </mesh>
        ))}

        {/* Vänster arm */}
        <group ref={r3f(refs.lShRef)} position={[-W_SHLDR, H_TORSO * 0.87, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB * 1.05} color={color} />
          <group ref={r3f(refs.lElRef)} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.12} color={skin} />
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
            <Joint r={R_LIMB * 1.12} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.88} color={skin} />
            <group position={[0, -H_LOWER, 0]}>
              <Hand skin={skin} />
            </group>
          </group>
        </group>
      </group>

      {/* ── Vänster ben – barfota ───────────────────────────────────── */}
      <group ref={r3f(refs.lHipRef)} position={[-W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        <group ref={r3f(refs.lKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.08} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          <Foot skin={skin} />
        </group>
      </group>

      {/* ── Höger ben – barfota ─────────────────────────────────────── */}
      <group ref={r3f(refs.rHipRef)} position={[W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        <group ref={r3f(refs.rKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.08} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          <Foot skin={skin} />
        </group>
      </group>
    </group>
  );
});
