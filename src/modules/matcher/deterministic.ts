/**
 * MATCHER DETERMINÍSTICO
 * =======================
 * Primera pasada, sin LLM. Resuelve con certeza los dos extremos:
 *
 *   1. GTIN igual en los dos lados  → match seguro, confianza 1.0
 *   2. Una señal dura CONTRADICE    → no-match seguro (capacidad distinta,
 *                                      generación distinta, variante distinta)
 *
 * Lo que queda en el medio devuelve `undefined` y pasa al LLM (Fase 3).
 *
 * El punto importante: las capacidades y las generaciones se deciden acá, no
 * en el LLM. Son comparaciones de números, no juicios de lenguaje — mandarlas
 * a un modelo sería más caro y menos confiable.
 */
import {
  extractCapacidad,
  extractGeneracion,
  extractModelCodes,
  extractVariante,
  normalizeGtin,
  tokenSimilarity,
} from './normalize';
import { tierFor, type MatchCandidate, type MatchVerdict } from './types';

function señales(c: MatchCandidate) {
  const texto = `${c.title} ${c.brand ?? ''} ${c.model ?? ''} ${c.capacity ?? ''}`;
  return {
    gtin: normalizeGtin(c.gtin),
    capacidad: extractCapacidad(c.capacity ?? '') ?? extractCapacidad(texto),
    generaciones: extractGeneracion(texto),
    modelCodes: extractModelCodes(texto),
    variante: extractVariante(texto),
  };
}

/**
 * `undefined` significa "no puedo decidir con certeza, que lo vea el LLM".
 * Nunca devuelve un match exacto sin una señal dura que lo respalde.
 */
export function matchDeterministic(
  a: MatchCandidate,
  b: MatchCandidate,
): MatchVerdict | undefined {
  const sa = señales(a);
  const sb = señales(b);

  // --- 1. GTIN: la señal más fuerte que existe ---
  if (sa.gtin && sb.gtin) {
    if (sa.gtin === sb.gtin) {
      return {
        match: true,
        confidence: 1,
        reason: `Mismo código de barras (GTIN ${sa.gtin}).`,
        method: 'gtin',
        tier: 'exacto',
      };
    }
    return {
      match: false,
      confidence: 0.98,
      reason: `Códigos de barras distintos (${sa.gtin} vs ${sb.gtin}): son productos diferentes.`,
      method: 'gtin',
      tier: 'similar',
    };
  }

  // --- 2. Descartes por contradicción de señal dura ---

  // Capacidad distinta ⇒ no es el mismo producto. Este es el caso
  // 128 GB vs 256 GB, que es el que más daño hace si se deja pasar.
  if (sa.capacidad && sb.capacidad && sa.capacidad.gb !== sb.capacidad.gb) {
    return {
      match: false,
      confidence: 0.95,
      reason: `Capacidad distinta: ${sa.capacidad.raw.trim()} vs ${sb.capacidad.raw.trim()}.`,
      method: 'descarte',
      tier: 'similar',
    };
  }

  // Generación distinta ⇒ modelos de distinto año (iPhone 14 vs 15, XM4 vs XM5).
  if (sa.generaciones.length > 0 && sb.generaciones.length > 0) {
    const compartida = sa.generaciones.some((g) => sb.generaciones.includes(g));
    if (!compartida) {
      return {
        match: false,
        confidence: 0.92,
        reason: `Generación o modelo distinto: "${sa.generaciones.join(', ')}" vs "${sb.generaciones.join(', ')}".`,
        method: 'descarte',
        tier: 'similar',
      };
    }
  }

  // Variante de línea distinta (Pro vs base, Plus vs Mini).
  if (sa.variante !== sb.variante && (sa.variante || sb.variante)) {
    return {
      match: false,
      confidence: 0.88,
      reason: `Variante distinta: "${sa.variante ?? 'sin variante'}" vs "${sb.variante ?? 'sin variante'}".`,
      method: 'descarte',
      tier: 'similar',
    };
  }

  // Marca distinta y ambas conocidas ⇒ descarte (el genérico que imita).
  if (a.brand && b.brand) {
    const ba = a.brand.toLowerCase().trim();
    const bb = b.brand.toLowerCase().trim();
    const genericas = new Set(['generic', 'generico', 'sin marca', 'unbranded', 'oem']);
    if (ba !== bb && !(genericas.has(ba) && genericas.has(bb))) {
      return {
        match: false,
        confidence: 0.9,
        reason: `Marca distinta: ${a.brand} vs ${b.brand}.`,
        method: 'descarte',
        tier: 'similar',
      };
    }
  }

  // --- 3. Señal de identidad compartida ---
  // Primero el número de modelo, que es la señal más específica. Si no hay,
  // sirve la combinación marca + generación: "Apple iPhone 15" de los dos
  // lados identifica el producto igual de bien, y es el caso más común
  // cuando los títulos no traen el código interno del fabricante.
  const modeloComun = sa.modelCodes.find((m) => sb.modelCodes.includes(m));
  const mismaMarca =
    Boolean(a.brand && b.brand) &&
    a.brand!.toLowerCase().trim() === b.brand!.toLowerCase().trim();
  const generacionComun =
    mismaMarca && sa.generaciones.length > 0
      ? sa.generaciones.find((g) => sb.generaciones.includes(g))
      : undefined;

  const señalComun = modeloComun ?? generacionComun;
  const etiquetaSeñal = modeloComun
    ? `número de modelo (${modeloComun.toUpperCase()})`
    : `marca y generación (${a.brand} ${generacionComun})`;

  if (señalComun) {
    // Si uno declara capacidad y el otro no, NUNCA es exacto: la variante
    // está sin confirmar y es justo donde se esconde el error caro.
    const capacidadIncompleta = Boolean(sa.capacidad) !== Boolean(sb.capacidad);
    if (capacidadIncompleta) {
      return {
        match: true,
        confidence: 0.8,
        reason: `Mismo ${etiquetaSeñal}, pero sólo uno de los dos declara la capacidad: verificá la variante.`,
        method: 'model',
        tier: tierFor(0.8, true),
      };
    }
    const sim = tokenSimilarity(a.title, b.title);
    const conf = Math.min(0.97, 0.88 + sim * 0.1);
    return {
      match: true,
      confidence: conf,
      reason: `Mismo ${etiquetaSeñal}${sa.capacidad ? ` y misma capacidad (${sa.capacidad.raw.trim()})` : ''}.`,
      method: 'model',
      tier: tierFor(conf, true),
    };
  }

  // --- 4. Sin señales duras: que decida el LLM ---
  return undefined;
}
