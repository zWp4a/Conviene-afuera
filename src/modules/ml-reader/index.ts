/**
 * ML-READER
 * ==========
 * Recibe un link de Mercado Libre Uruguay y devuelve el producto normalizado.
 *
 * Con credenciales configuradas pega contra la API oficial; sin ellas
 * devuelve datos mock, así que la app corre entera sin configurar nada.
 *
 * Verificado el 2026-11-07: la API rechaza con 403 toda llamada sin token,
 * incluso a endpoints públicos. Hay que registrar una app en
 * developers.mercadolibre.com.uy. Ver README § "Fase 2".
 */
import { cached, defaultCache, TTL, type CacheStore } from '@/lib/cache';
import type { Money } from '@/lib/money';
import { hayCredenciales } from './auth';
import { fetchProduct } from './client';
import { getMockProduct } from './mock';
import { parseMLUrl } from './parse-url';
import type { MLProduct } from './types';

export * from './types';
export { parseMLUrl, isMLUrl } from './parse-url';
export { MOCK_PRODUCTS } from './mock';
export { hayCredenciales, resetTokenCache } from './auth';
export { mapItem, mapCatalogProduct, mapAttributes, parseWeightToGrams } from './mapper';

export interface MLReaderOptions {
  readonly cache?: CacheStore;
  /**
   * Precio que escribió la persona mirando la pantalla de Mercado Libre.
   * Ver `PRECIO_NO_DISPONIBLE` en types.ts para por qué hace falta.
   */
  readonly precioManual?: Money;
  /** Fuerza el uso de mocks aunque haya credenciales (para tests y demos). */
  readonly forceMock?: boolean;
}

/** `true` si estamos sirviendo datos mock en lugar de la API real. */
export function usandoMock(opts: MLReaderOptions = {}): boolean {
  if (opts.forceMock) return true;
  return !hayCredenciales();
}

export async function readMLProduct(
  url: string,
  opts: MLReaderOptions = {},
): Promise<MLProduct> {
  const parsed = parseMLUrl(url);
  const store = opts.cache ?? defaultCache;

  // El precio manual forma parte de la clave: si la persona corrige el
  // precio, no queremos devolverle el resultado viejo cacheado.
  const key = `ml:${parsed.itemId}:${opts.precioManual?.cents ?? ''}${opts.precioManual?.currency ?? ''}`;

  return cached(store, key, TTL.BUSQUEDA_MS, async () => {
    if (usandoMock(opts)) {
      return getMockProduct(parsed.itemId, parsed.canonicalUrl);
    }
    return fetchProduct(parsed, opts.precioManual);
  });
}
