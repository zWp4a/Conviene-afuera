/**
 * PRODUCTOS MOCK DE MERCADO LIBRE
 * ================================
 * Permite desarrollar y demostrar la app entera sin red ni credenciales.
 * Se activa cuando no hay ML_CLIENT_ID configurado (Fase 1).
 */
import { usd, uyu } from '@/lib/money';
import type { MLProduct } from './types';

export const MOCK_PRODUCTS: readonly MLProduct[] = [
  {
    id: 'MLU123456789',
    url: 'https://articulo.mercadolibre.com.uy/MLU-123456789-apple-iphone-15-128-gb-negro-_JM',
    title: 'Apple iPhone 15 128 GB Negro',
    price: uyu(42990),
    attributes: {
      brand: 'Apple',
      model: 'iPhone 15',
      gtin: '195949036194',
      capacity: '128 GB',
      color: 'Negro',
      extra: { 'Línea': 'iPhone', 'Modelo del procesador': 'A16 Bionic' },
    },
    weightGrams: 600,
    categoryId: 'MLU1055',
    condition: 'new',
    seller: { id: 1, nickname: 'TIENDA_OFICIAL_APPLE', esTiendaOficial: true, reputacion: 'verde' },
    shipping: { envioGratis: true, esFull: true },
    images: [],
    warrantyText: 'Garantía de fábrica: 12 meses',
    source: 'mock',
  },
  {
    id: 'MLU987654321',
    url: 'https://articulo.mercadolibre.com.uy/MLU-987654321-sony-wh-1000xm5-auriculares-_JM',
    title: 'Auriculares Sony WH-1000XM5 Inalámbricos Negro',
    price: uyu(18500),
    attributes: {
      brand: 'Sony',
      model: 'WH-1000XM5',
      gtin: '027242923072',
      color: 'Negro',
    },
    weightGrams: 450,
    categoryId: 'MLU1002',
    condition: 'new',
    seller: { id: 2, nickname: 'AUDIOSHOP_UY', esTiendaOficial: false, reputacion: 'verde' },
    shipping: { envioGratis: true, esFull: false },
    images: [],
    warrantyText: 'Garantía del vendedor: 6 meses',
    source: 'mock',
  },
  {
    id: 'MLU555000111',
    url: 'https://articulo.mercadolibre.com.uy/MLU-555000111-kindle-paperwhite-16gb-_JM',
    title: 'Amazon Kindle Paperwhite 11va Generación 16 GB Negro',
    price: usd(249),
    attributes: {
      brand: 'Amazon',
      model: 'Kindle Paperwhite 11va Gen',
      capacity: '16 GB',
      color: 'Negro',
    },
    categoryId: 'MLU1648',
    condition: 'new',
    seller: { id: 3, nickname: 'IMPORTADOS_MVD', esTiendaOficial: false },
    shipping: { envioGratis: false, esFull: false, costo: uyu(290) },
    images: [],
    source: 'mock',
  },
];

/**
 * Busca un mock por item id. Si no existe uno exacto, devuelve el primero:
 * así cualquier link válido sirve para probar la app en la Fase 1.
 */
export function getMockProduct(itemId: string, url: string): MLProduct {
  const exact = MOCK_PRODUCTS.find((p) => p.id === itemId);
  if (exact) return exact;
  const base = MOCK_PRODUCTS[0]!;
  return { ...base, id: itemId, url };
}
