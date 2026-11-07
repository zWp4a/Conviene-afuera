/**
 * ML-READER
 * ==========
 * Recibe un link de Mercado Libre Uruguay y devuelve el producto normalizado.
 *
 * FASE 1 (actual): devuelve datos mock. El parseo y la validación de la URL
 * son reales y están testeados.
 *
 * FASE 2: `client.ts` contra la API oficial de ML (`GET /items/{id}`), con
 * OAuth. Ver README § "Fase 2". La doc de ML exige `Authorization: Bearer`,
 * así que hace falta registrar una app en developers.mercadolibre.com.uy.
 */
import { cached, defaultCache, TTL, type CacheStore } from '@/lib/cache';
import { env } from '@/lib/env';
import { getMockProduct } from './mock';
import { parseMLUrl } from './parse-url';
import type { MLProduct } from './types';

export * from './types';
export { parseMLUrl, isMLUrl } from './parse-url';
export { MOCK_PRODUCTS } from './mock';

export interface MLReaderOptions {
  readonly cache?: CacheStore;
  /** Fuerza el uso de mocks aunque haya credenciales (para tests y demos). */
  readonly forceMock?: boolean;
}

/** `true` si estamos sirviendo datos mock en lugar de la API real. */
export function usandoMock(opts: MLReaderOptions = {}): boolean {
  if (opts.forceMock) return true;
  return !env().ML_CLIENT_ID;
}

export async function readMLProduct(
  url: string,
  opts: MLReaderOptions = {},
): Promise<MLProduct> {
  const parsed = parseMLUrl(url);
  const store = opts.cache ?? defaultCache;

  return cached(store, `ml:${parsed.itemId}`, TTL.BUSQUEDA_MS, async () => {
    if (usandoMock(opts)) {
      return getMockProduct(parsed.itemId, parsed.canonicalUrl);
    }
    // FASE 2: const { fetchItem } = await import('./client');
    //         return fetchItem(parsed);
    return getMockProduct(parsed.itemId, parsed.canonicalUrl);
  });
}
