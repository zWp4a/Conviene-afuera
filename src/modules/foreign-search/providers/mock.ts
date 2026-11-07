/**
 * PROVIDER MOCK
 * ==============
 * Datos de ejemplo para desarrollar sin gastar API. Incluye a propósito casos
 * difíciles para el matcher: misma familia con otra capacidad, modelo de otro
 * año, y genéricos que se parecen al original.
 */
import { usd } from '@/lib/money';
import type { ForeignOffer, ProductSearchProvider, SearchQuery } from '../types';

const CATALOGO: readonly ForeignOffer[] = [
  // --- iPhone 15: el match correcto es el de 128 GB ---
  {
    providerId: 'mock',
    externalId: 'MOCK-IP15-128',
    title: 'Apple iPhone 15 128GB Black Unlocked',
    price: usd(649),
    domesticShipping: usd(0),
    originCountry: 'US',
    merchantTaxCountry: 'US',
    weightGrams: 600,
    gtin: '195949036194',
    brand: 'Apple',
    model: 'iPhone 15',
    condition: 'new',
    url: 'https://example.com/mock/iphone-15-128',
    merchantName: 'MockStore US',
  },
  {
    // Trampa para el matcher: misma familia, otra capacidad.
    providerId: 'mock',
    externalId: 'MOCK-IP15-256',
    title: 'Apple iPhone 15 256GB Black Unlocked',
    price: usd(729),
    domesticShipping: usd(0),
    originCountry: 'US',
    merchantTaxCountry: 'US',
    weightGrams: 600,
    gtin: '195949036293',
    brand: 'Apple',
    model: 'iPhone 15',
    condition: 'new',
    url: 'https://example.com/mock/iphone-15-256',
    merchantName: 'MockStore US',
  },
  {
    // Trampa: modelo de otro año.
    providerId: 'mock',
    externalId: 'MOCK-IP14-128',
    title: 'Apple iPhone 14 128GB Midnight Unlocked',
    price: usd(529),
    domesticShipping: usd(0),
    originCountry: 'US',
    merchantTaxCountry: 'US',
    weightGrams: 580,
    brand: 'Apple',
    model: 'iPhone 14',
    condition: 'new',
    url: 'https://example.com/mock/iphone-14-128',
    merchantName: 'MockStore US',
  },
  // --- Sony WH-1000XM5 ---
  {
    providerId: 'mock',
    externalId: 'MOCK-XM5',
    title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones Black',
    price: usd(298),
    domesticShipping: usd(0),
    originCountry: 'US',
    merchantTaxCountry: 'US',
    weightGrams: 450,
    gtin: '027242923072',
    brand: 'Sony',
    model: 'WH-1000XM5',
    condition: 'new',
    url: 'https://example.com/mock/sony-xm5',
    merchantName: 'MockStore US',
  },
  {
    // Trampa: generación anterior.
    providerId: 'mock',
    externalId: 'MOCK-XM4',
    title: 'Sony WH-1000XM4 Wireless Noise Canceling Headphones Black',
    price: usd(228),
    domesticShipping: usd(0),
    originCountry: 'US',
    merchantTaxCountry: 'US',
    weightGrams: 440,
    brand: 'Sony',
    model: 'WH-1000XM4',
    condition: 'new',
    url: 'https://example.com/mock/sony-xm4',
    merchantName: 'MockStore US',
  },
  {
    // Trampa: genérico que imita. Origen CN ⇒ sin exención de IVA.
    providerId: 'mock',
    externalId: 'MOCK-GEN-ANC',
    title: 'Wireless Noise Cancelling Headphones for Sony WH-1000XM5 Style Black',
    price: usd(39),
    domesticShipping: usd(4.99),
    originCountry: 'CN',
    weightGrams: 400,
    brand: 'Generic',
    condition: 'new',
    url: 'https://example.com/mock/generic-anc',
    merchantName: 'MockStore CN',
  },
  // --- Kindle: caso con valor alto, para probar el cupo ---
  {
    providerId: 'mock',
    externalId: 'MOCK-KINDLE-16',
    title: 'Amazon Kindle Paperwhite (16 GB) 11th Generation Black',
    price: usd(149),
    domesticShipping: usd(0),
    originCountry: 'US',
    merchantTaxCountry: 'US',
    weightGrams: 350,
    brand: 'Amazon',
    model: 'Kindle Paperwhite 11th Gen',
    condition: 'new',
    url: 'https://example.com/mock/kindle-pw-16',
    merchantName: 'MockStore US',
  },
  {
    // Caso de valor alto, para probar el tope de USD 800 del simplificado.
    providerId: 'mock',
    externalId: 'MOCK-MACBOOK',
    title: 'Apple MacBook Air 13 M3 256GB Midnight',
    price: usd(899),
    domesticShipping: usd(0),
    originCountry: 'US',
    merchantTaxCountry: 'US',
    weightGrams: 1700,
    brand: 'Apple',
    model: 'MacBook Air 13 M3',
    condition: 'new',
    url: 'https://example.com/mock/macbook-air-m3',
    merchantName: 'MockStore US',
  },
];

/** Coincidencia laxa a propósito: el filtro fino lo hace el `matcher`. */
function relevancia(offer: ForeignOffer, q: SearchQuery): number {
  if (q.gtin && offer.gtin === q.gtin) return 100;
  const needle = q.q.toLowerCase();
  const hay = `${offer.brand ?? ''} ${offer.model ?? ''} ${offer.title}`.toLowerCase();
  const tokens = needle.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return (hits / tokens.length) * 100;
}

export class MockProvider implements ProductSearchProvider {
  readonly id = 'mock' as const;
  readonly displayName = 'Tienda de ejemplo (mock)';

  isConfigured(): boolean {
    return true;
  }

  async search(query: SearchQuery): Promise<readonly ForeignOffer[]> {
    const limit = query.limit ?? 10;
    return CATALOGO.map((o) => ({ offer: o, score: relevancia(o, query) }))
      .filter((x) => x.score >= 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.offer);
  }
}

export const MOCK_CATALOGO = CATALOGO;
