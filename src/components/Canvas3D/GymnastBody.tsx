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
function Head({ skin, hair }: { skin: string; hair: string }) {
  return (
    <>
      {/* Huvud */}
      <mesh castShadow>
        <sphereGeometry args={[H_HEAD, 18, 14]} />
        <meshPhysicalMaterial color={skin} roughness={0.60} metalness={0} />
      </mesh>

      {/* Hår – täcker topp + baksida (+Z) */}
      <mesh position={[0, H_HEAD * 0.14, H_HEAD * 0.06]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.88, 16, 12]} />
        <meshPhysicalMaterial color={hair} roughness={0.78} metalness={0.04}
          clearcoat={0.22} clearcoatRoughness={0.42} />
      </mesh>
      {/* Bakre hårsektion */}
      <mesh position={[0, -H_HEAD * 0.02, H_HEAD * 0.55]} castShadow>
        <sphereGeometry args={[H_HEAD * 0.64, 12, 10]} />
        <meshPhysicalMaterial color={hair} roughness={0.80} metalness={0.04} />
      </mesh>

      {/* Hästsvans – tre kapslar bakåt-nedåt */}
      <mesh position={[0, -H_HEAD * 0.08, H_HEAD * 0.82]} rotation={[P * 0.20, 0, 0]} castShadow>
        <capsuleGeometry args={[0.022, 0.11, 5, 10]} />
        <meshPhysicalMaterial color={hair} roughness={0.82} metalness={0} />
      </mesh>
      <mesh position={[0, -H_HEAD * 0.28, H_HEAD * 1.14]} rotation={[P * 0.32, 0, 0]} castShadow>
        <capsuleGeometry args={[0.017, 0.09, 4, 8]} />
        <meshPhysicalMaterial color={hair} roughness={0.82} metalness={0} />
      </mesh>
      <mesh position={[0, -H_HEAD * 0.48, H_HEAD * 1.38]} rotation={[P * 0.42, 0, 0]} castShadow>
        <capsuleGeometry args={[0.012, 0.07, 4, 8]} />
        <meshPhysicalMaterial color={hair} roughness={0.82} metalness={0} />
      </mesh>

      {/* Ögonvitor */}
      <mesh position={[-H_HEAD * 0.36, H_HEAD * 0.10, -H_HEAD * 0.86]} castShadow>
        <sphereGeometry args={[0.014, 8, 6]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.2} metalness={0} />
      </mesh>
      <mesh position={[ H_HEAD * 0.36, H_HEAD * 0.10, -H_HEAD * 0.86]} castShadow>
        <sphereGeometry args={[0.014, 8, 6]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.2} metalness={0} />
      </mesh>

      {/* Pupiller – något framför ögonvitorna (mer negativ Z) */}
      <mesh position={[-H_HEAD * 0.36, H_HEAD * 0.10, -H_HEAD * 0.895]} castShadow>
        <sphereGeometry args={[0.009, 7, 6]} />
        <meshPhysicalMaterial color="#1a1a2e" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[ H_HEAD * 0.36, H_HEAD * 0.10, -H_HEAD * 0.895]} castShadow>
        <sphereGeometry args={[0.009, 7, 6]} />
        <meshPhysicalMaterial color="#1a1a2e" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Näsa */}
      <mesh position={[0, -H_HEAD * 0.04, -H_HEAD * 0.96]} castShadow>
        <sphereGeometry args={[0.013, 7, 6]} />
        <meshPhysicalMaterial color={skin} roughness={0.66} metalness={0} />
      </mesh>

      {/* Mun */}
      <mesh position={[0, -H_HEAD * 0.26, -H_HEAD * 0.92]} rotation={[P * 0.06, 0, 0]} castShadow>
        <capsuleGeometry args={[0.007, 0.026, 4, 6]} />
        <meshPhysicalMaterial color="#c36060" roughness={0.55} metalness={0} />
      </mesh>

      {/* Rouge/kinder – subtila prickar */}
      <mesh position={[-H_HEAD * 0.55, -H_HEAD * 0.12, -H_HEAD * 0.70]} castShadow>
        <sphereGeometry args={[0.010, 6, 5]} />
        <meshPhysicalMaterial color="#f5b5b5" roughness={0.75} metalness={0} transparent opacity={0.45} />
      </mesh>
      <mesh position={[ H_HEAD * 0.55, -H_HEAD * 0.12, -H_HEAD * 0.70]} castShadow>
        <sphereGeometry args={[0.010, 6, 5]} />
        <meshPhysicalMaterial color="#f5b5b5" roughness={0.75} metalness={0} transparent opacity={0.45} />
      </mesh>
    </>
  );
}

// ─── Sko – tåspets mot −Z ─────────────────────────────────────────────────────
// Placeras i lKn/rKn-frame. Knät roterar shin+sko runt X,
// så skon följer alltid underbenet.
function Shoe({ soleColor = "#111" }: { soleColor?: string } = {}) {
  return (
    <group position={[0, -H_SHIN - 0.01, 0]}>
      {/* Själva skon – överdel mot ristan */}
      <mesh position={[0, -0.018, -0.028]} rotation={[P * 0.18, 0, 0]} castShadow>
        <capsuleGeometry args={[0.026, 0.068, 5, 8]} />
        <meshPhysicalMaterial color="#2a2a3a" roughness={0.65} metalness={0.05} />
      </mesh>
      {/* Sula */}
      <mesh position={[0, -0.035, -0.020]} rotation={[P * 0.18, 0, 0]} castShadow>
        <capsuleGeometry args={[0.027, 0.072, 4, 8]} />
        <meshPhysicalMaterial color={soleColor} roughness={0.9} metalness={0} />
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
          <cylinderGeometry args={[R_BODY * 0.80, R_BODY * 1.05, H_TORSO, 14]} />
          <meshPhysicalMaterial color={color} roughness={0.48} metalness={0.05}
            clearcoat={0.35} clearcoatRoughness={0.30} />
        </mesh>

        {/* Leotard-V-ringning på framsidan (−Z) */}
        <mesh position={[0, H_TORSO * 0.88, -R_BODY * 0.78]} rotation={[P * 0.18, 0, 0]} castShadow>
          <capsuleGeometry args={[0.008, 0.06, 4, 6]} />
          <meshPhysicalMaterial color={skin} roughness={0.55} metalness={0} />
        </mesh>

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
            {/* Handled */}
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.026, 8, 6]} />
              <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>

        {/* Höger arm */}
        <group ref={r3f(refs.rShRef)} position={[W_SHLDR, H_TORSO * 0.87, 0]}>
          <LeotardSeg len={H_UPPER} r={R_LIMB * 1.05} color={color} />
          <group ref={r3f(refs.rElRef)} position={[0, -H_UPPER, 0]}>
            <Joint r={R_LIMB * 1.12} color={skin} />
            <SkinSeg len={H_LOWER} r={R_LIMB * 0.88} color={skin} />
            <mesh position={[0, -H_LOWER, 0]} castShadow>
              <sphereGeometry args={[0.026, 8, 6]} />
              <meshPhysicalMaterial color={skin} roughness={0.68} metalness={0} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ── Vänster ben ─────────────────────────────────────────────── */}
      <group ref={r3f(refs.lHipRef)} position={[-W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        <group ref={r3f(refs.lKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.08} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          <Shoe />
        </group>
      </group>

      {/* ── Höger ben ───────────────────────────────────────────────── */}
      <group ref={r3f(refs.rHipRef)} position={[W_HIP, 0, 0]}>
        <LeotardSeg len={H_THIGH} r={R_LEG * 1.02} color={color} />
        <group ref={r3f(refs.rKnRef)} position={[0, -H_THIGH, 0]}>
          <Joint r={R_LEG * 1.08} color={skin} />
          <SkinSeg len={H_SHIN} r={R_LEG * 0.88} color={skin} />
          <Shoe />
        </group>
      </group>
    </group>
  );
});
