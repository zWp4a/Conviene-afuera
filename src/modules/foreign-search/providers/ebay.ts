/**
 * PROVIDER: eBay Browse API  — FASE 3
 * ====================================
 * Esqueleto. La implementación real va en la Fase 3.
 *
 * API: https://api.ebay.com/buy/browse/v1/item_summary/search
 * Auth: OAuth client credentials (gratis, ~5.000 llamadas/día).
 * Scope: https://api.ebay.com/oauth/api_scope
 *
 * Nota de diseño: eBay expone `itemLocation.country`, que sirve para
 * `originCountry`, pero NO expone la sede fiscal del vendedor. Por eso
 * `merchantTaxCountry` queda `undefined` y `landed-cost` no aplica la
 * exención de IVA: preferimos no prometer un ahorro que no se cumpla.
 */
import { env } from '@/lib/env';
import { ProviderError, type ForeignOffer, type ProductSearchProvider, type SearchQuery } from '../types';

export class EbayProvider implements ProductSearchProvider {
  readonly id = 'ebay' as const;
  readonly displayName = 'eBay';

  isConfigured(): boolean {
    const e = env();
    return Boolean(e.EBAY_CLIENT_ID && e.EBAY_CLIENT_SECRET);
  }

  async search(_query: SearchQuery): Promise<readonly ForeignOffer[]> {
    if (!this.isConfigured()) {
      throw new ProviderError('ebay', 'Falta configurar EBAY_CLIENT_ID y EBAY_CLIENT_SECRET.');
    }
    // FASE 3: token client-credentials + item_summary/search + mapeo a ForeignOffer.
    throw new ProviderError('ebay', 'El provider de eBay se implementa en la Fase 3.');
  }
}
