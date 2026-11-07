/**
 * TESTS DEL MATCHER CON CLAUDE
 * =============================
 * Con cliente inyectado: no gastan API y corren en CI.
 *
 * Lo que se verifica no es que Claude acierte — eso se mide aparte — sino
 * que el módulo lo use con desconfianza: que no lo llame cuando no hace
 * falta, que no le crea cuando no justifica, y que un fallo suyo no voltee
 * la consulta del usuario.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildUserPrompt,
  matchProducts,
  SYSTEM_PROMPT,
  UMBRALES,
  veredictoSchema,
  type LlmClient,
  type MatchCandidate,
} from '@/modules/matcher';

const c = (title: string, extra: Partial<MatchCandidate> = {}): MatchCandidate => ({
  title,
  ...extra,
});

function llmQueDice(out: { match: boolean; confidence: number; reason: string }): LlmClient {
  return { comparar: vi.fn(async () => out) };
}

/** Par ambiguo: sin GTIN, sin número de modelo, sin capacidad ni generación. */
const A = c('Cafetera express para casa, acero inoxidable');
const B = c('Stainless steel home espresso coffee machine');

describe('cuándo se llama a Claude (y cuándo no)', () => {
  it('NO se lo llama si la capa determinística ya decidió', async () => {
    const llm = llmQueDice({ match: true, confidence: 1, reason: 'da igual' });
    const v = await matchProducts(
      c('Apple iPhone 15 128 GB', { gtin: '195949036194' }),
      c('Apple iPhone 15 128GB', { gtin: '195949036194' }),
      { llm },
    );
    expect(v.method).toBe('gtin');
    expect(llm.comparar).not.toHaveBeenCalled();
  });

  it('NO se lo llama para descartar por capacidad: eso es aritmética', async () => {
    const llm = llmQueDice({ match: true, confidence: 1, reason: 'da igual' });
    const v = await matchProducts(
      c('Apple iPhone 15 128 GB', { brand: 'Apple' }),
      c('Apple iPhone 15 256 GB', { brand: 'Apple' }),
      { llm },
    );
    expect(v.match).toBe(false);
    expect(llm.comparar).not.toHaveBeenCalled();
  });

  it('SÍ se lo llama cuando no hay señales duras', async () => {
    const llm = llmQueDice({
      match: true,
      confidence: 0.92,
      reason: 'Misma marca y mismo modelo de cafetera express.',
    });
    const v = await matchProducts(A, B, { llm });
    expect(llm.comparar).toHaveBeenCalledOnce();
    expect(v.method).toBe('llm');
    expect(v.tier).toBe('exacto');
  });
});

describe('desconfianza del veredicto de Claude', () => {
  it('un reason que no nombra ningún atributo baja la confianza', async () => {
    const llm = llmQueDice({
      match: true,
      confidence: 0.98,
      reason: 'Son el mismo producto, se parecen mucho.',
    });
    const v = await matchProducts(A, B, { llm });
    expect(v.confidence).toBeLessThanOrEqual(0.7);
    expect(v.tier).not.toBe('exacto');
  });

  it('un reason que sí nombra un atributo conserva la confianza', async () => {
    const llm = llmQueDice({
      match: true,
      confidence: 0.95,
      reason: 'Coinciden la marca y el modelo del producto.',
    });
    const v = await matchProducts(A, B, { llm });
    expect(v.confidence).toBe(0.95);
    expect(v.tier).toBe('exacto');
  });

  it('respeta los umbrales asimétricos: 0,8 es "verificar", no "exacto"', async () => {
    const llm = llmQueDice({
      match: true,
      confidence: 0.8,
      reason: 'Mismo modelo, pero no se declara el color en uno de los dos.',
    });
    const v = await matchProducts(A, B, { llm });
    expect(v.tier).toBe('verificar');
    expect(v.confidence).toBeLessThan(UMBRALES.EXACTO);
  });

  it('un no-match de Claude se respeta tal cual', async () => {
    const llm = llmQueDice({
      match: false,
      confidence: 0.9,
      reason: 'El segundo es una funda, no el producto.',
    });
    const v = await matchProducts(A, B, { llm });
    expect(v.match).toBe(false);
    expect(v.tier).toBe('similar');
  });
});

describe('cuando Claude falla', () => {
  it('no voltea la consulta: cae al heurístico conservador', async () => {
    const llm: LlmClient = {
      comparar: vi.fn(async () => {
        throw new Error('529 overloaded');
      }),
    };
    const v = await matchProducts(A, B, { llm });
    expect(v.method).toBe('sin-datos');
    expect(v.match).toBe(false);
    expect(v.tier).toBe('similar');
  });

  it('una respuesta que no valida contra el schema se trata como fallo', () => {
    expect(veredictoSchema.safeParse({ match: 'sí', confidence: 2, reason: '' }).success).toBe(
      false,
    );
    expect(veredictoSchema.safeParse({ match: true, confidence: 1.5, reason: 'x' }).success).toBe(
      false,
    );
    expect(
      veredictoSchema.safeParse({ match: true, confidence: 0.9, reason: 'Misma marca.' }).success,
    ).toBe(true);
  });
});

describe('prompt', () => {
  it('incluye todos los atributos disponibles de los dos lados', () => {
    const p = buildUserPrompt(
      c('iPhone 15', { brand: 'Apple', model: 'iPhone 15', capacity: '128 GB', gtin: '123' }),
      c('iPhone 15 Black', { brand: 'Apple' }),
    );
    expect(p).toContain('PRODUCTO A (Mercado Libre Uruguay)');
    expect(p).toContain('PRODUCTO B (tienda del exterior)');
    expect(p).toContain('capacidad: 128 GB');
    expect(p).toContain('gtin: 123');
  });

  it('omite las líneas de los atributos que no existen', () => {
    const p = buildUserPrompt(c('Algo'), c('Something'));
    expect(p).not.toContain('marca:');
    expect(p).not.toContain('gtin:');
  });

  it('el system prompt nombra las trampas que tiene que evitar', () => {
    for (const trampa of ['capacidad', 'generación', 'accesorio', 'compatibilidad', 'pack']) {
      expect(SYSTEM_PROMPT.toLowerCase()).toContain(trampa.toLowerCase());
    }
  });

  it('el system prompt exige que el reason nombre un atributo', () => {
    expect(SYSTEM_PROMPT).toContain('DEBE nombrar el atributo concreto');
  });
});
