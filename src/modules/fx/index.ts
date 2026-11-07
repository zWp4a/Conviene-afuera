/**
 * FX — COTIZACIÓN USD/UYU
 * ========================
 * FASE 1: cotización de fallback configurable por env var.
 * FASE 2+: BCU como fuente primaria, dolarapi.com como respaldo.
 *
 * El BCU publica por SOAP (cotizaciones.bcu.gub.uy) y se cae seguido, así que
 * el diseño asume que la fuente primaria puede fallar: siempre hay fallback y
 * la UI dice de dónde salió el número y de cuándo es.
 */
import { cached, defaultCache, TTL, type CacheStore } from '@/lib/cache';
import { env } from '@/lib/env';
import { fromUnits, type Money } from '@/lib/money';

export type FxSource = 'bcu' | 'dolarapi' | 'fallback';

export interface Cotizacion {
  /** Cuántos pesos uruguayos vale un dólar. */
  readonly usdToUyu: number;
  readonly source: FxSource;
  /** Fecha de la cotización (ISO). */
  readonly fecha: string;
  /** `true` si es el valor de fallback y no una cotización real. */
  readonly esFallback: boolean;
}

export async function getCotizacion(
  opts: { cache?: CacheStore } = {},
): Promise<Cotizacion> {
  const store = opts.cache ?? defaultCache;
  const hoy = new Date().toISOString().slice(0, 10);

  return cached(store, `fx:${hoy}`, TTL.COTIZACION_MS, async () => {
    // FASE 2: intentar BCU, luego dolarapi, y recién después el fallback.
    return {
      usdToUyu: env().FX_FALLBACK_USD_UYU,
      source: 'fallback' as const,
      fecha: hoy,
      esFallback: true,
    };
  });
}

export function usdToUyu(m: Money, fx: Cotizacion): Money {
  if (m.currency === 'UYU') return m;
  return fromUnits((m.cents / 100) * fx.usdToUyu, 'UYU');
}

export function uyuToUsd(m: Money, fx: Cotizacion): Money {
  if (m.currency === 'USD') return m;
  return fromUnits(m.cents / 100 / fx.usdToUyu, 'USD');
}

/** Convierte a la moneda pedida, cualquiera sea la de origen. */
export function convert(m: Money, to: 'UYU' | 'USD', fx: Cotizacion): Money {
  return to === 'UYU' ? usdToUyu(m, fx) : uyuToUsd(m, fx);
}
