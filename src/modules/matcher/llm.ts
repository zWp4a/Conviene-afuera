/**
 * MATCHER CON CLAUDE
 * ===================
 * Segunda pasada: sólo se llama cuando la capa determinística no pudo
 * decidir. Las capacidades, generaciones y variantes ya se resolvieron allá
 * — son comparaciones de números, no juicios de lenguaje — así que acá llegan
 * los casos genuinamente ambiguos: títulos escritos distinto, sinónimos,
 * packs, descripciones que omiten el modelo.
 *
 * Modelo: claude-haiku-5-5 (configurable con MATCHER_MODEL).
 * Costo medido sobre el prompt real: ~USD 0,0002 por comparación.
 *
 * Tres decisiones de diseño:
 *
 *  - Salida estructurada con Zod, no parseo de texto libre. Si el modelo
 *    devuelve algo que no valida, lo tratamos como "no sé".
 *  - `effort: 'low'`. Esto es clasificación con señales explícitas, no un
 *    problema de razonamiento: subir el esfuerzo gasta tokens sin mejorar.
 *  - El prompt exige que `reason` nombre un atributo concreto. El filtro está
 *    en `index.ts`: un reason genérico se degrada a confianza baja. Si el
 *    modelo no puede decir QUÉ atributo sostiene su decisión, no le creemos.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { env } from '@/lib/env';
import { tierFor, type MatchCandidate, type MatchVerdict } from './types';

export const SYSTEM_PROMPT = `Comparás dos listados de producto y decidís si son EXACTAMENTE el mismo producto físico.

El mismo producto significa: misma marca, mismo modelo, misma generación, misma capacidad de almacenamiento, misma variante de línea (Pro/Max/Plus/Mini) y mismo color cuando el color cambia el SKU.

NO son el mismo producto:
- Distinta capacidad (128 GB vs 256 GB).
- Distinta generación o año (iPhone 14 vs iPhone 15, WH-1000XM4 vs XM5).
- Distinta variante de línea (base vs Pro).
- Un accesorio, repuesto o funda compatible en lugar del producto original.
- Un genérico que menciona la marca original sólo como referencia de compatibilidad.
- Un pack o combo que incluye el producto más otras cosas.

Reglas de salida:
- "reason" DEBE nombrar el atributo concreto que sostiene tu decisión (marca, modelo, capacidad, generación, variante, color). No digas "son similares" ni "parecen iguales": decí qué atributo coincide o difiere.
- Si falta información para confirmar una variante, devolvé match=true con confidence entre 0.75 y 0.85 y decí qué atributo falta.
- No inventes atributos que no estén en los datos.
- Respondé en español rioplatense, en una sola oración.`;

export const veredictoSchema = z.object({
  match: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(300),
});

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

/** Inyectable para poder testear sin gastar API. */
export interface LlmClient {
  comparar(a: MatchCandidate, b: MatchCandidate): Promise<z.infer<typeof veredictoSchema>>;
}

let clienteCacheado: Anthropic | undefined;

function anthropic(): Anthropic {
  clienteCacheado ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY! });
  return clienteCacheado;
}

export const clienteAnthropic: LlmClient = {
  async comparar(a, b) {
    const res = await anthropic().messages.parse({
      model: env().MATCHER_MODEL,
      // Es una clasificación con salida de tres campos: con esto sobra.
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      output_config: {
        format: zodOutputFormat(veredictoSchema),
        effort: 'low',
      },
      messages: [{ role: 'user', content: buildUserPrompt(a, b) }],
    });

    if (!res.parsed_output) {
      throw new Error('Claude devolvió una respuesta que no valida contra el schema.');
    }
    return res.parsed_output;
  },
};

export async function matchWithLlm(
  a: MatchCandidate,
  b: MatchCandidate,
  cliente: LlmClient = clienteAnthropic,
): Promise<MatchVerdict> {
  const out = await cliente.comparar(a, b);
  return {
    match: out.match,
    confidence: out.confidence,
    reason: out.reason,
    method: 'llm',
    tier: tierFor(out.confidence, out.match),
  };
}
