import type { Money } from '@/lib/money';

export type ProviderId = 'mock' | 'ebay' | 'amazon';

export interface SearchQuery {
  /** Texto de búsqueda ya normalizado. */
  readonly q: string;
  /** GTIN/EAN si lo conocemos: los providers que lo soporten lo priorizan. */
  readonly gtin?: string;
  readonly brand?: string;
  readonly model?: string;
  /** Máximo de resultados por provider. */
  readonly limit?: number;
}

/**
 * Oferta de una tienda del exterior.
 *
 * Sobre los dos campos de país — la distinción importa y es sutil:
 *   `originCountry`     de dónde sale físicamente el paquete. Define qué
 *                       couriers sirven y cuánto tarda.
 *   `merchantTaxCountry` dónde tributa el comercio. Es lo que define si aplica
 *                       la exención de IVA de hasta USD 200 (acuerdo TIFA).
 *                       Rara vez lo exponen las APIs: si es `undefined`,
 *                       `landed-cost` NO aplica la exención y lo advierte.
 */
export interface ForeignOffer {
  readonly providerId: ProviderId;
  /** Id en la tienda de origen (ASIN, item id de eBay, etc.). */
  readonly externalId: string;
  readonly title: string;
  readonly price: Money;
  /** Envío hasta el warehouse de Miami (o directo). `undefined` ⇒ desconocido. */
  readonly domesticShipping?: Money;
  readonly originCountry: string;
  readonly merchantTaxCountry?: string;
  readonly weightGrams?: number;
  readonly gtin?: string;
  readonly brand?: string;
  readonly model?: string;
  readonly condition: 'new' | 'used' | 'refurbished' | 'unknown';
  readonly url: string;
  /** Espacio preparado para links de afiliado. Sin integrar todavía (v2). */
  readonly affiliateUrl?: string;
  readonly merchantName?: string;
  readonly imageUrl?: string;
}

/**
 * Todo provider del exterior implementa esta interfaz. Agregar AliExpress,
 * Shein o lo que sea es escribir una clase más y registrarla.
 * Ver README § "Cómo agregar un provider nuevo".
 */
export interface ProductSearchProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  /** `false` si falta configuración (API key, etc.). */
  isConfigured(): boolean;
  search(query: SearchQuery): Promise<readonly ForeignOffer[]>;
}

export class ProviderError extends Error {
  constructor(
    readonly providerId: ProviderId,
    readonly userMessage: string,
    cause?: unknown,
  ) {
    super(`[${providerId}] ${userMessage}`);
    this.name = 'ProviderError';
    if (cause !== undefined) this.cause = cause;
  }
}
