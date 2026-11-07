/**
 * TESTS DE LA CAPA DE API DE MERCADO LIBRE (Fase 2)
 * ==================================================
 * Las fixtures reproducen la forma real de las respuestas de ML. Lo que más
 * importa acá es el mapeo de atributos: de ahí sale el GTIN que le ahorra al
 * matcher una llamada al LLM, y la capacidad que evita comparar un 128 GB
 * contra un 256 GB.
 */
import { describe, expect, it } from 'vitest';
import itemFixture from './fixtures/ml-item.json';
import productFixture from './fixtures/ml-product.json';
import { toUnits } from '@/lib/money';
import { mlItemSchema, mlProductSchema } from '@/modules/ml-reader/schema';
import { mapAttributes, mapCatalogProduct, mapItem, parseWeightToGrams } from '@/modules/ml-reader';

const URL_FALLBACK = 'https://www.mercadolibre.com.uy/p/MLU12345678';

describe('schema: tolera cambios de la API', () => {
  it('parsea una respuesta de /items completa', () => {
    expect(mlItemSchema.safeParse(itemFixture).success).toBe(true);
  });

  it('parsea una respuesta de /products completa', () => {
    expect(mlProductSchema.safeParse(productFixture).success).toBe(true);
  });

  it('acepta un item mínimo: si ML saca campos, degradamos en vez de romper', () => {
    const r = mlItemSchema.safeParse({ id: 'MLU1', title: 'Algo' });
    expect(r.success).toBe(true);
  });

  it('rechaza lo que no tiene id ni título: sin eso no hay producto', () => {
    expect(mlItemSchema.safeParse({ price: 100 }).success).toBe(false);
  });

  it('tolera nulls donde ML manda null en vez de omitir', () => {
    const r = mlItemSchema.safeParse({
      id: 'MLU1',
      title: 'Algo',
      price: null,
      currency_id: null,
      warranty: null,
      official_store_id: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('mapeo de /items', () => {
  const p = mapItem(mlItemSchema.parse(itemFixture), URL_FALLBACK);

  it('extrae el GTIN, que es lo que le ahorra plata al matcher', () => {
    expect(p.attributes.gtin).toBe('195949036194');
  });

  it('extrae marca, modelo, capacidad y color', () => {
    expect(p.attributes.brand).toBe('Apple');
    expect(p.attributes.model).toBe('iPhone 15');
    expect(p.attributes.capacity).toBe('128 GB');
    expect(p.attributes.color).toBe('Negro');
  });

  it('extrae el peso y lo normaliza a gramos', () => {
    expect(p.weightGrams).toBe(600);
  });

  it('mapea precio y moneda', () => {
    expect(toUnits(p.price)).toBe(42990);
    expect(p.price.currency).toBe('UYU');
  });

  it('detecta tienda oficial y envío Full', () => {
    expect(p.seller.esTiendaOficial).toBe(true);
    expect(p.shipping.esFull).toBe(true);
    expect(p.shipping.envioGratis).toBe(true);
  });

  it('usa el permalink de ML y no la URL que pegó el usuario', () => {
    expect(p.url).toContain('articulo.mercadolibre.com.uy');
  });

  it('marca el origen como api, para que la UI no muestre el cartel de mock', () => {
    expect(p.source).toBe('api');
  });

  it('guarda el resto de los atributos por si el matcher los necesita', () => {
    expect(p.attributes.extra?.['Condición']).toBe('Nuevo');
  });
});

describe('mapeo de /products (catálogo)', () => {
  const p = mapCatalogProduct(mlProductSchema.parse(productFixture), URL_FALLBACK);

  it('saca el precio del buy_box_winner', () => {
    expect(toUnits(p.price)).toBe(18500);
  });

  it('extrae el modelo alfanumérico y el EAN', () => {
    expect(p.attributes.model).toBe('WH-1000XM5');
    expect(p.attributes.gtin).toBe('027242923072');
  });

  it('convierte kg a gramos', () => {
    expect(p.weightGrams).toBe(250);
  });

  it('sin buy_box_winner no rompe: deja el precio en cero', () => {
    const sinBuyBox = mlProductSchema.parse({ ...productFixture, buy_box_winner: null });
    expect(mapCatalogProduct(sinBuyBox, URL_FALLBACK).price.cents).toBe(0);
  });
});

describe('mapeo de atributos: los casos que rompen en la vida real', () => {
  it('usa MANUFACTURER cuando el vendedor no cargó BRAND', () => {
    const a = mapAttributes([{ id: 'MANUFACTURER', value_name: 'Logitech' }]);
    expect(a.brand).toBe('Logitech');
  });

  it('prefiere GTIN sobre EAN y UPC cuando están los tres', () => {
    const a = mapAttributes([
      { id: 'UPC', value_name: '111111111111' },
      { id: 'EAN', value_name: '2222222222222' },
      { id: 'GTIN', value_name: '3333333333333' },
    ]);
    expect(a.gtin).toBe('3333333333333');
  });

  it('ignora atributos con value_name vacío o null', () => {
    const a = mapAttributes([
      { id: 'BRAND', value_name: null },
      { id: 'MODEL', value_name: '' },
    ]);
    expect(a.brand).toBeUndefined();
    expect(a.model).toBeUndefined();
  });

  it('sin atributos devuelve un objeto vacío, no undefined', () => {
    expect(mapAttributes([])).toEqual({});
  });
});

describe('parseo de peso', () => {
  it('maneja las unidades que usa ML', () => {
    expect(parseWeightToGrams('600 g')).toBe(600);
    expect(parseWeightToGrams('1.2 kg')).toBe(1200);
    expect(parseWeightToGrams('1,5 kg')).toBe(1500);
    expect(parseWeightToGrams('350 gr')).toBe(350);
    expect(parseWeightToGrams('2 lb')).toBe(907);
  });

  it('devuelve undefined cuando no puede: ahí se estima por categoría', () => {
    expect(parseWeightToGrams(undefined)).toBeUndefined();
    expect(parseWeightToGrams('liviano')).toBeUndefined();
    expect(parseWeightToGrams('0 kg')).toBeUndefined();
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * CATÁLOGO (el camino que quedó, porque /items está cerrado)
 * ────────────────────────────────────────────────────────────────────────── */

import catalogSearch from './fixtures/ml-catalog-search.json';
import catalogProduct from './fixtures/ml-catalog-product.json';
import catalogItems from './fixtures/ml-catalog-items.json';
import { extraerTituloDelSlug } from '@/modules/ml-reader/parse-url';
import { elegirDelCatalogo, rankearCatalogo } from '@/modules/ml-reader/client';
import { listingMasBarata, mapCatalog } from '@/modules/ml-reader/mapper';
import {
  mlCatalogItemsSchema,
  mlCatalogProductSchema,
  mlCatalogSearchSchema,
} from '@/modules/ml-reader/schema';
import { usd, uyu } from '@/lib/money';

describe('título desde el slug de la URL', () => {
  it('saca el título de un link de artículo', () => {
    expect(
      extraerTituloDelSlug('/MLU-123456789-apple-iphone-15-128-gb-negro-_JM'),
    ).toBe('apple iphone 15 128 gb negro');
  });

  it('funciona sin el sufijo _JM', () => {
    expect(extraerTituloDelSlug('/MLU-472674662-modem-lte-a-300-mbs')).toBe('modem lte a 300 mbs');
  });

  it('devuelve undefined cuando el slug no tiene nada útil', () => {
    expect(extraerTituloDelSlug('/MLU-123456789')).toBeUndefined();
    expect(extraerTituloDelSlug('/MLU-123456789-_JM')).toBeUndefined();
    expect(extraerTituloDelSlug('/p/MLU12345678')).toBeUndefined();
  });

  it('decodifica caracteres escapados', () => {
    expect(extraerTituloDelSlug('/MLU-1-caf%C3%A9-molido-_JM')).toContain('caf');
  });
});

describe('schemas del catálogo contra respuestas reales', () => {
  it('parsea /products/search', () => {
    expect(mlCatalogSearchSchema.safeParse(catalogSearch).success).toBe(true);
  });
  it('parsea /products/{id}', () => {
    expect(mlCatalogProductSchema.safeParse(catalogProduct).success).toBe(true);
  });
  it('parsea /products/{id}/items', () => {
    expect(mlCatalogItemsSchema.safeParse(catalogItems).success).toBe(true);
  });
});

describe('elección del producto en el catálogo', () => {
  const resultados = mlCatalogSearchSchema.parse(catalogSearch).results;

  it('con el slug del iPhone negro elige el negro, no el verde', () => {
    const r = elegirDelCatalogo('apple iphone 15 128 gb negro', resultados);
    const elegido = resultados.find((x) => x.id === r?.productId);
    expect(elegido?.name.toLowerCase()).toContain('negro');
    expect(elegido?.name.toLowerCase()).not.toContain('verde');
  });

  it('descarta por capacidad distinta aunque el título se parezca', () => {
    const r = rankearCatalogo('apple iphone 15 512 gb negro', resultados);
    for (const c of r) {
      const n = resultados.find((x) => x.id === c.productId)?.name ?? '';
      expect(n).not.toMatch(/128\s*GB/i);
    }
  });

  it('devuelve varios candidatos ordenados, no uno solo', () => {
    // Importa porque un producto del catálogo puede no tener publicaciones:
    // el cliente prueba el siguiente en vez de devolver precio 0.
    const r = rankearCatalogo('apple iphone 15', resultados);
    expect(r.length).toBeGreaterThan(1);
    expect(r[0]!.confianza).toBeGreaterThanOrEqual(r[1]!.confianza);
  });

  it('no inventa un match cuando nada se parece', () => {
    expect(elegirDelCatalogo('bicicleta rodado 29 aluminio', resultados)).toBeUndefined();
  });
});

describe('precio desde las publicaciones del catálogo', () => {
  const listings = mlCatalogItemsSchema.parse(catalogItems).results;

  it('toma la publicación más barata, que es con la que hay que comparar', () => {
    expect(listingMasBarata(listings)?.price).toBe(970);
  });

  it('sin publicaciones devuelve undefined en vez de cero', () => {
    expect(listingMasBarata([])).toBeUndefined();
  });

  it('ignora publicaciones sin precio', () => {
    const r = listingMasBarata([
      { item_id: 'A', price: null, currency_id: 'USD' },
      { item_id: 'B', price: 500, currency_id: 'USD' },
    ] as never);
    expect(r?.item_id).toBe('B');
  });
});

describe('mapeo del catálogo a producto', () => {
  const product = mlCatalogProductSchema.parse(catalogProduct);
  const listings = mlCatalogItemsSchema.parse(catalogItems).results;

  it('combina atributos del catálogo con el precio de la publicación', () => {
    const p = mapCatalog(product, listings, 'https://x.uy');
    expect(p.attributes.brand).toBe('Apple');
    expect(p.attributes.capacity).toBe('128 GB');
    expect(p.price).toEqual(usd(970));
    expect(p.priceSource).toBe('catalogo');
  });

  it('el precio del usuario pisa al del catálogo y queda marcado como tal', () => {
    const p = mapCatalog(product, listings, 'https://x.uy', uyu(42990));
    expect(p.price).toEqual(uyu(42990));
    expect(p.priceSource).toBe('usuario');
  });

  it('sin publicaciones y sin precio manual, el precio queda en cero', () => {
    // El cliente detecta esto y pide el precio en vez de comparar contra 0.
    expect(mapCatalog(product, [], 'https://x.uy').price.cents).toBe(0);
  });
});
