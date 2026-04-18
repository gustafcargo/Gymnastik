/**
 * safariWebGLFix – patchar WebGLRenderingContext.getShaderPrecisionFormat så
 * den aldrig returnerar null.
 *
 * iOS Safari har en bugg (bekräftad t.o.m. iOS 17.x på iPad Air) där
 * `gl.getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT)` returnerar null
 * under vissa förhållanden trots att WebGL-kontexten är giltig. Three.js
 * läser därefter `.precision` på resultatet och kastar
 *   "null is not an object (evaluating '…getShaderPrecisionFormat(...).precision')"
 * vilket kraschar hela renderaren innan scenen hinner starta.
 *
 * Patchen går på prototypen så alla nuvarande och framtida kontexter
 * ärver fixen. Defaultvärdena (range 127/127, precision 23) motsvarar
 * IEEE-754 single precision float vilket är det alla moderna GPU:er har.
 */
export function applySafariWebGLFix(): void {
  if (typeof window === "undefined") return;

  const Ctx1 = (window as unknown as { WebGLRenderingContext?: { prototype: unknown } }).WebGLRenderingContext;
  const Ctx2 = (window as unknown as { WebGL2RenderingContext?: { prototype: unknown } }).WebGL2RenderingContext;
  const protos: Record<string, unknown>[] = [];
  if (Ctx1?.prototype) protos.push(Ctx1.prototype as Record<string, unknown>);
  if (Ctx2?.prototype) protos.push(Ctx2.prototype as Record<string, unknown>);

  const FALLBACK = Object.freeze({ rangeMin: 127, rangeMax: 127, precision: 23 });

  for (const proto of protos) {
    if (proto.__gymnastikPrecisionPatched) continue;
    const original = proto.getShaderPrecisionFormat as
      | ((this: unknown, shaderType: number, precisionType: number) => WebGLShaderPrecisionFormat | null)
      | undefined;
    if (typeof original !== "function") continue;
    proto.getShaderPrecisionFormat = function (
      this: unknown,
      shaderType: number,
      precisionType: number,
    ): WebGLShaderPrecisionFormat {
      try {
        const r = original.call(this, shaderType, precisionType);
        if (r) return r;
      } catch {
        // Safari kan i sällsynta fall kasta istället för null-retur
      }
      return FALLBACK as WebGLShaderPrecisionFormat;
    };
    proto.__gymnastikPrecisionPatched = true;
  }
}
