/**
 * REGISTRY DE PROVIDERS
 * ======================
 * Un provider se agrega acá y en ningún otro lugar.
 * Ver README § "Cómo agregar un provider nuevo".
 */
import { env } from '@/lib/env';
import { AmazonProvider } from './providers/amazon';
import { EbayProvider } from './providers/ebay';
import { MockProvider } from './providers/mock';
import type { ProductSearchProvider, ProviderId } from './types';

const CONSTRUCTORES: Record<ProviderId, () => ProductSearchProvider> = {
  mock: () => new MockProvider(),
  ebay: () => new EbayProvider(),
  amazon: () => new AmazonProvider(),
};

function esProviderId(x: string): x is ProviderId {
  return x === 'mock' || x === 'ebay' || x === 'amazon';
}

/**
 * Providers activos según FOREIGN_SEARCH_PROVIDERS (lista separada por comas).
 * Descarta en silencio los que están sin configurar, y si no queda ninguno
 * cae al mock para que la app nunca quede sin resultados en desarrollo.
 */
export function activeProviders(): readonly ProductSearchProvider[] {
  const ids = env()
    .FOREIGN_SEARCH_PROVIDERS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(esProviderId);

  const activos = ids.map((id) => CONSTRUCTORES[id]()).filter((p) => p.isConfigured());
  return activos.length > 0 ? activos : [new MockProvider()];
}

export function getProvider(id: ProviderId): ProductSearchProvider {
  return CONSTRUCTORES[id]();
}
