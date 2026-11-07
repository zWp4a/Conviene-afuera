/**
 * FOREIGN-SEARCH
 * ===============
 * Busca un producto en las tiendas del exterior, en paralelo, en todos los
 * providers activos. Un provider que falla no voltea la búsqueda: se registra
 * y se sigue con los demás.
 */
import { cached, defaultCache, TTL, type CacheStore } from '@/lib/cache';
import { activeProviders } from './registry';
import type { ForeignOffer, SearchQuery } from './types';

export * from './types';
export { activeProviders, getProvider } from './registry';
export { MockProvider, MOCK_CATALOGO } from './providers/mock';

export interface SearchResult {
  readonly offers: readonly ForeignOffer[];
  /** Providers que fallaron, para avisar en la UI sin romper el resultado. */
  readonly errores: readonly { readonly providerId: string; readonly message: string }[];
  readonly providersConsultados: readonly string[];
}

export async function searchForeign(
  query: SearchQuery,
  opts: { cache?: CacheStore } = {},
): Promise<SearchResult> {
  const store = opts.cache ?? defaultCache;
  const providers = activeProviders();
  const key = `fs:${providers.map((p) => p.id).join('+')}:${query.gtin ?? ''}:${query.q.toLowerCase()}`;

  return cached(store, key, TTL.BUSQUEDA_MS, async () => {
    const settled = await Promise.allSettled(providers.map((p) => p.search(query)));

    const offers: ForeignOffer[] = [];
    const errores: { providerId: string; message: string }[] = [];

    settled.forEach((r, i) => {
      const provider = providers[i]!;
      if (r.status === 'fulfilled') {
        offers.push(...r.value);
      } else {
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errores.push({ providerId: provider.id, message });
      }
    });

    return {
      offers,
      errores,
      providersConsultados: providers.map((p) => p.id),
    };
  });
}

/** Arma la query de búsqueda a partir de los datos del producto de ML. */
export function buildQuery(input: {
  title: string;
  brand?: string;
  model?: string;
  gtin?: string;
  capacity?: string;
}): SearchQuery {
  // Si tenemos marca y modelo, es mejor señal que el título completo de ML,
  // que viene cargado de ruido ("Nuevo", "Envío gratis", "12 cuotas").
  const core = [input.brand, input.model, input.capacity].filter(Boolean).join(' ').trim();
  return {
    q: core.length >= 4 ? core : input.title,
    ...(input.gtin ? { gtin: input.gtin } : {}),
    ...(input.brand ? { brand: input.brand } : {}),
    ...(input.model ? { model: input.model } : {}),
    limit: 10,
  };
}
