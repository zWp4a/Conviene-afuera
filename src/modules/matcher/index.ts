/**
 * MATCHER
 * ========
 * Decide si una oferta del exterior es el MISMO producto que el de ML.
 *
 * Orden: determinístico primero (GTIN, capacidad, generación, variante,
 * marca, número de modelo); LLM sólo para lo que queda sin resolver.
 *
 * FASE 1: sólo la capa determinística. Lo que no resuelve queda como
 * 'similar' con confianza baja, que es el comportamiento conservador correcto:
 * preferimos decir "no sé" antes que afirmar un match que no podemos sostener.
 */
import { matchDeterministic } from './deterministic';
import { isLlmConfigured, matchWithLlm } from './llm';
import { tokenSimilarity } from './normalize';
import { tierFor, type MatchCandidate, type MatchVerdict } from './types';

export * from './types';
export * from './normalize';
export { matchDeterministic } from './deterministic';
export { isLlmConfigured, SYSTEM_PROMPT, OUTPUT_SCHEMA, buildUserPrompt } from './llm';

/** Un `reason` que no nombra un atributo concreto no es confiable. */
const PALABRAS_DE_ATRIBUTO = [
  'gtin', 'codigo', 'código', 'capacidad', 'gb', 'tb', 'modelo', 'marca',
  'generacion', 'generación', 'variante', 'color', 'version', 'versión', 'talle',
];

export function reasonNombraAtributo(reason: string): boolean {
  const r = reason.toLowerCase();
  return PALABRAS_DE_ATRIBUTO.some((p) => r.includes(p));
}

export async function matchProducts(
  a: MatchCandidate,
  b: MatchCandidate,
): Promise<MatchVerdict> {
  const det = matchDeterministic(a, b);
  if (det) return det;

  if (isLlmConfigured()) {
    try {
      const llm = await matchWithLlm(a, b);
      // Si el modelo no puede nombrar el atributo que sostiene su decisión,
      // le bajamos la confianza en lugar de creerle.
      if (llm.match && !reasonNombraAtributo(llm.reason)) {
        const conf = Math.min(llm.confidence, 0.7);
        return { ...llm, confidence: conf, tier: tierFor(conf, llm.match) };
      }
      return { ...llm, tier: tierFor(llm.confidence, llm.match) };
    } catch {
      // Si el LLM falla, caemos al heurístico de abajo en lugar de romper.
    }
  }

  // Sin LLM: heurístico conservador. Nunca llega a 'exacto'.
  const sim = tokenSimilarity(a.title, b.title);
  const conf = Math.min(0.7, sim);
  return {
    match: false,
    confidence: Math.round(conf * 100) / 100,
    reason: `Sin código de barras ni número de modelo en común: no puedo confirmar que sea el mismo producto (similitud de título ${Math.round(sim * 100)}%).`,
    method: 'sin-datos',
    tier: 'similar',
  };
}

/** Clasifica una lista de ofertas en exactas / a verificar / similares. */
export async function matchAll<T extends MatchCandidate>(
  base: MatchCandidate,
  candidates: readonly T[],
): Promise<readonly { readonly candidate: T; readonly verdict: MatchVerdict }[]> {
  const results = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      verdict: await matchProducts(base, candidate),
    })),
  );
  const orden = { exacto: 0, verificar: 1, similar: 2 } as const;
  return results.sort(
    (x, y) =>
      orden[x.verdict.tier] - orden[y.verdict.tier] ||
      y.verdict.confidence - x.verdict.confidence,
  );
}
