/**
 * TESTS DE FX
 * ============
 * Lo importante no es la conversión (eso es una multiplicación), es que la
 * cadena de fuentes degrade bien y que una cotización vieja se detecte.
 * dolarapi nos devolvió un dato de siete semanas atrás sin avisar.
 */
import { describe, expect, it } from 'vitest';
import { MemoryCache } from '@/lib/cache';
import { toUnits, usd, uyu } from '@/lib/money';
import {
  describirCotizacion,
  getCotizacion,
  MAX_ANTIGUEDAD_DIAS,
  usdToUyu,
  uyuToUsd,
  type FxProvider,
} from '@/modules/fx';

const AHORA = new Date('2026-11-07T12:00:00Z');

function provider(id: 'bcu' | 'dolarapi', usdToUyuVal: number, fecha: string): FxProvider {
  return { id, fetchCotizacion: async () => ({ usdToUyu: usdToUyuVal, fecha }) };
}

function providerQueFalla(id: 'bcu' | 'dolarapi'): FxProvider {
  return {
    id,
    fetchCotizacion: async () => {
      throw new Error('403 Forbidden');
    },
  };
}

describe('cadena de fuentes', () => {
  it('usa la primera fuente que responde', async () => {
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [provider('bcu', 41, '2026-11-07'), provider('dolarapi', 99, '2026-11-07')],
    });
    expect(fx.source).toBe('bcu');
    expect(fx.usdToUyu).toBe(41);
  });

  it('cae a la siguiente cuando la primera falla', async () => {
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [providerQueFalla('bcu'), provider('dolarapi', 41.25, '2026-11-07')],
    });
    expect(fx.source).toBe('dolarapi');
    expect(fx.esFallback).toBe(false);
  });

  it('si fallan todas usa el respaldo configurado y lo declara', async () => {
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [providerQueFalla('bcu'), providerQueFalla('dolarapi')],
    });
    expect(fx.source).toBe('fallback');
    expect(fx.esFallback).toBe(true);
    expect(fx.usdToUyu).toBeGreaterThan(0);
  });

  it('rechaza una cotización inválida y sigue con la próxima', async () => {
    const roto: FxProvider = {
      id: 'bcu',
      fetchCotizacion: async () => ({ usdToUyu: 0, fecha: '2026-11-07' }),
    };
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [roto, provider('dolarapi', 41.25, '2026-11-07')],
    });
    expect(fx.source).toBe('dolarapi');
  });

  it('cachea: no vuelve a pedir en el mismo día', async () => {
    const cache = new MemoryCache();
    let llamadas = 0;
    const contador: FxProvider = {
      id: 'dolarapi',
      fetchCotizacion: async () => {
        llamadas += 1;
        return { usdToUyu: 41, fecha: '2026-11-07' };
      },
    };
    await getCotizacion({ cache, ahora: AHORA, providers: [contador] });
    await getCotizacion({ cache, ahora: AHORA, providers: [contador] });
    expect(llamadas).toBe(1);
  });
});

describe('detección de cotización vieja', () => {
  it('una cotización de hoy no está desactualizada', async () => {
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [provider('dolarapi', 41.25, '2026-11-07T10:00:00Z')],
    });
    expect(fx.antiguedadDias).toBe(0);
    expect(fx.desactualizada).toBe(false);
  });

  it('detecta el caso real: dolarapi sirvió un dato de siete semanas atrás', async () => {
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [provider('dolarapi', 41.25, '2026-09-21T21:01:08.360Z')],
    });
    expect(fx.antiguedadDias).toBeGreaterThan(40);
    expect(fx.desactualizada).toBe(true);
    expect(describirCotizacion(fx)).toContain('desactualizada');
  });

  it('el umbral tolera un fin de semana largo', async () => {
    const tresDias = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [provider('dolarapi', 41, '2026-11-04T12:00:00Z')],
    });
    expect(tresDias.antiguedadDias).toBe(3);
    expect(tresDias.desactualizada).toBe(false);
    expect(MAX_ANTIGUEDAD_DIAS).toBe(4);
  });

  it('una fecha ilegible se trata como vieja, no como fresca', async () => {
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [provider('dolarapi', 41, 'no es una fecha')],
    });
    expect(fx.desactualizada).toBe(true);
  });

  it('el texto del respaldo aclara que no es una cotización real', async () => {
    const fx = await getCotizacion({
      cache: new MemoryCache(),
      ahora: AHORA,
      providers: [providerQueFalla('dolarapi')],
    });
    expect(describirCotizacion(fx)).toContain('respaldo');
  });
});

describe('conversión', () => {
  const fx = {
    usdToUyu: 41.25,
    source: 'dolarapi' as const,
    fecha: '2026-11-07',
    esFallback: false,
    antiguedadDias: 0,
    desactualizada: false,
  };

  it('convierte USD a UYU', () => {
    expect(toUnits(usdToUyu(usd(100), fx))).toBeCloseTo(4125, 2);
  });

  it('convierte UYU a USD', () => {
    expect(toUnits(uyuToUsd(uyu(4125), fx))).toBeCloseTo(100, 2);
  });

  it('no toca un monto que ya está en la moneda pedida', () => {
    expect(usdToUyu(uyu(500), fx)).toEqual(uyu(500));
    expect(uyoToUsdNoop()).toBe(true);
    function uyoToUsdNoop() {
      return uyuToUsd(usd(7), fx).cents === usd(7).cents;
    }
  });

  it('ida y vuelta no pierde más de un centésimo', () => {
    const ida = usdToUyu(usd(299.99), fx);
    const vuelta = uyuToUsd(ida, fx);
    expect(Math.abs(vuelta.cents - usd(299.99).cents)).toBeLessThanOrEqual(1);
  });
});
