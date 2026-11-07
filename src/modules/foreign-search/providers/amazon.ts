/**
 * PROVIDER: Amazon — DESACTIVADO EN EL MVP
 * =========================================
 * Decisión tomada en el plan: el MVP va sólo con eBay.
 *
 * El motivo es que la Product Advertising API 5.0 (oficial y gratis) exige una
 * cuenta de Amazon Associates con 3 ventas calificadas en 180 días, lo que es
 * un huevo-y-gallina para un proyecto nuevo. Las alternativas pagas son
 * Rainforest API (~USD 50/mes, devuelve ASIN y peso de envío) y SerpAPI
 * (~USD 75/mes).
 *
 * Este archivo queda escrito para que prenderlo sea cambiar una env var:
 *   AMAZON_PROVIDER=rainforest|serpapi|paapi  (por defecto: off)
 */
import { env } from '@/lib/env';
import { ProviderError, type ForeignOffer, type ProductSearchProvider, type SearchQuery } from '../types';

export class AmazonProvider implements ProductSearchProvider {
  readonly id = 'amazon' as const;
  readonly displayName = 'Amazon';

  isConfigured(): boolean {
    const e = env();
    switch (e.AMAZON_PROVIDER) {
      case 'off':
        return false;
      case 'serpapi':
        return Boolean(e.SERPAPI_KEY);
      case 'rainforest':
        return Boolean(e.RAINFOREST_KEY);
      case 'paapi':
        return false; // requiere credenciales de Associates, no implementado
    }
  }

  async search(_query: SearchQuery): Promise<readonly ForeignOffer[]> {
    throw new ProviderError(
      'amazon',
      'Amazon está desactivado en el MVP. Se habilita con AMAZON_PROVIDER y la key del proveedor elegido.',
    );
  }
}
