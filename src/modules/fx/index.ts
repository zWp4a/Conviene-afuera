/**
 * FX — COTIZACIÓN USD/UYU
 * ========================
 * Cadena de fuentes con caché diaria y respaldo manual, como pide el brief.
 *
 * Orden: BCU (si está habilitado) → dolarapi → valor de respaldo.
 *
 * Dos decisiones que importan:
 *
 *  - Usamos la cotización de VENTA. El usuario está por gastar dólares, no
 *    por venderlos. Tomar la compra inflaría el ahorro que le mostramos.
 *  - Calculamos siempre la antigüedad del dato. Las fuentes públicas sirven
 *    cotizaciones viejas sin avisar — dolarapi nos devolvió una de siete
 *    semanas atrás — y con el dólar movido eso desplaza todos los totales.
 *    Si está vieja, el cálculo sigue pero la UI lo dice.
 */
import { cached, defaultCache, TTL, type CacheStore } from '@/lib/cache';
import { env } from '@/lib/env';
import { fromUnits, type Money } from '@/lib/money';
import { BcuProvider } from './bcu';
import { DolarApiProvider } from './dolarapi';
import { MAX_ANTIGUEDAD_DIAS, type Cotizacion, type FxProvider } from './types';

export * from './types';
export { DolarApiProvider, DOLARAPI_URL } from './dolarapi';
export { BcuProvider } from './bcu';

const TIMEOUT_MS = 5000;

function diasDesde(fechaIso: string, ahora: Date): number {
  const t = Date.parse(fechaIso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((ahora.getTime() - t) / 86_400_000));
}

export interface GetCotizacionOptions {
  readonly cache?: CacheStore;
  /** Inyectables para tests. Por defecto, la cadena real. */
  readonly providers?: readonly FxProvider[];
  readonly ahora?: Date;
}

function providersPorDefecto(): readonly FxProvider[] {
  const chain: FxProvider[] = [];
  if (env().FX_ENABLE_BCU) chain.push(new BcuProvider());
  chain.push(new DolarApiProvider());
  return chain;
}

export async function getCotizacion(opts: GetCotizacionOptions = {}): Promise<Cotizacion> {
  const store = opts.cache ?? defaultCache;
  const ahora = opts.ahora ?? new Date();
  const hoy = ahora.toISOString().slice(0, 10);

  return cached(store, `fx:${hoy}`, TTL.COTIZACION_MS, async () => {
    const providers = opts.providers ?? providersPorDefecto();

    for (const provider of providers) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const { usdToUyu, fecha } = await provider.fetchCotizacion(controller.signal);
        if (!Number.isFinite(usdToUyu) || usdToUyu <= 0) {
          throw new Error(`${provider.id} devolvió una cotización inválida: ${usdToUyu}`);
        }
        const antiguedadDias = diasDesde(fecha, ahora);
        return {
          usdToUyu,
          source: provider.id,
          fecha,
          esFallback: false,
          antiguedadDias,
          desactualizada: antiguedadDias > MAX_ANTIGUEDAD_DIAS,
        };
      } catch (error) {
        console.warn(
          `[fx] ${provider.id} falló: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        clearTimeout(timer);
      }
    }

    // Respaldo manual: nunca dejamos la app sin cotización.
    return {
      usdToUyu: env().FX_FALLBACK_USD_UYU,
      source: 'fallback' as const,
      fecha: hoy,
      esFallback: true,
      antiguedadDias: 0,
      desactualizada: true,
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

export function convert(m: Money, to: 'UYU' | 'USD', fx: Cotizacion): Money {
  return to === 'UYU' ? usdToUyu(m, fx) : uyuToUsd(m, fx);
}

/** Texto para la UI sobre el origen y la frescura del dato. */
export function describirCotizacion(fx: Cotizacion): string {
  if (fx.esFallback) {
    return `1 USD = ${fx.usdToUyu} UYU (valor de respaldo configurado, no una cotización real).`;
  }
  const origen = fx.source === 'bcu' ? 'BCU' : 'dolarapi.com';
  const fecha = fx.fecha.slice(0, 10);
  if (fx.desactualizada) {
    return `1 USD = ${fx.usdToUyu} UYU (venta, ${origen}, del ${fecha} — hace ${fx.antiguedadDias} días). La cotización está desactualizada: los totales en pesos son aproximados.`;
  }
  return `1 USD = ${fx.usdToUyu} UYU (venta, ${origen}, ${fecha}).`;
}
