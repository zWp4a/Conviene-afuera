/**
 * MATCHER CON CLAUDE — FASE 3
 * ============================
 * Esqueleto. Sólo se llama cuando el matcher determinístico no pudo decidir.
 *
 * Modelo elegido: claude-haiku-5-5 (configurable con MATCHER_MODEL).
 * Costo estimado: ~USD 0,0002 por comparación ⇒ ~USD 2 / 1.000 consultas.
 *
 * Diseño pensado para la Fase 3:
 *  - Salida estructurada (`output_config.format`) con el schema de MatchVerdict,
 *    no parseo de texto libre.
 *  - El prompt exige que `reason` NOMBRE un atributo concreto. Un `reason`
 *    genérico se degrada a tier 'similar' en `index.ts`: si el modelo no puede
 *    decir qué atributo sostiene su decisión, no le creemos.
 *  - Caché de 7 días por par de títulos: un match no cambia si no cambia el
 *    título.
 */
import { env } from '@/lib/env';
import type { MatchCandidate, MatchVerdict } from './types';

export const SYSTEM_PROMPT = `Comparás dos listados de producto y decidís si son EXACTAMENTE el mismo producto físico.

El mismo producto significa: misma marca, mismo modelo, misma generación, misma capacidad de almacenamiento, misma variante de línea (Pro/Max/Plus/Mini) y mismo color cuando el color cambia el SKU.

NO son el mismo producto:
- Distinta capacidad (128 GB vs 256 GB).
- Distinta generación o año (iPhone 14 vs iPhone 15, WH-1000XM4 vs XM5).
- Distinta variante de línea (base vs Pro).
- Un accesorio o repuesto compatible en lugar del producto original.
- Un genérico que menciona la marca original como referencia de compatibilidad.

Reglas de salida:
- "reason" DEBE nombrar el atributo concreto que sostiene tu decisión. No digas "son similares" ni "parecen iguales": decí qué atributo coincide o difiere.
- Si falta información para decidir una variante, devolvé match=true con confidence entre 0.75 y 0.85 y decí qué atributo falta.
- No inventes atributos que no estén en los datos.`;

/** Schema de salida estructurada para la Fase 3. */
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    match: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string', maxLength: 300 },
  },
  required: ['match', 'confidence', 'reason'],
  additionalProperties: false,
} as const;

export function isLlmConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}

export function buildUserPrompt(a: MatchCandidate, b: MatchCandidate): string {
  const fmt = (c: MatchCandidate, label: string) =>
    [
      `${label}:`,
      `  titulo: ${c.title}`,
      c.brand ? `  marca: ${c.brand}` : null,
      c.model ? `  modelo: ${c.model}` : null,
      c.capacity ? `  capacidad: ${c.capacity}` : null,
      c.gtin ? `  gtin: ${c.gtin}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  return `${fmt(a, 'PRODUCTO A (Mercado Libre Uruguay)')}\n\n${fmt(b, 'PRODUCTO B (tienda del exterior)')}`;
}

export async function matchWithLlm(
  _a: MatchCandidate,
  _b: MatchCandidate,
): Promise<MatchVerdict> {
  // FASE 3: @anthropic-ai/sdk, client.messages.create con output_config.format.
  throw new Error('El matcher con Claude se implementa en la Fase 3.');
}
