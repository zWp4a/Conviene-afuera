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
