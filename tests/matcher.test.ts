/**
 * TESTS DEL MATCHER
 * ==================
 * El brief pide pares que SÍ son iguales y pares que PARECEN iguales pero no
 * lo son. Los segundos son los importantes: un falso positivo muestra un
 * ahorro que no existe y destruye la credibilidad del producto.
 */
import { describe, expect, it } from 'vitest';
import {
  extractCapacidad,
  extractGeneracion,
  extractModelCodes,
  extractVariante,
  matchDeterministic,
  matchProducts,
  normalizeGtin,
  normalizeText,
  reasonNombraAtributo,
  tierFor,
  UMBRALES,
  type MatchCandidate,
} from '@/modules/matcher';

const c = (title: string, extra: Partial<MatchCandidate> = {}): MatchCandidate => ({
  title,
  ...extra,
});

describe('pares que SÍ son el mismo producto', () => {
  it('mismo GTIN ⇒ match exacto con confianza 1', async () => {
    const v = await matchProducts(
      c('Apple iPhone 15 128 GB Negro', { gtin: '195949036194' }),
      c('Apple iPhone 15 128GB Black Unlocked', { gtin: '195949036194' }),
    );
    expect(v.match).toBe(true);
    expect(v.confidence).toBe(1);
    expect(v.method).toBe('gtin');
    expect(v.tier).toBe('exacto');
  });

  it('UPC de 12 dígitos y EAN de 13 del mismo producto son el mismo código', async () => {
    const v = await matchProducts(
      c('Sony WH-1000XM5', { gtin: '027242923072' }),
      c('Sony WH-1000XM5 Black', { gtin: '0027242923072' }),
    );
    expect(v.match).toBe(true);
    expect(v.method).toBe('gtin');
  });

  it('mismo número de modelo y misma capacidad ⇒ match exacto', async () => {
    const v = await matchProducts(
      c('Auriculares Sony WH-1000XM5 Inalámbricos Negro', { brand: 'Sony', model: 'WH-1000XM5' }),
      c('Sony WH-1000XM5 Wireless Noise Canceling Headphones Black', { brand: 'Sony', model: 'WH-1000XM5' }),
    );
    expect(v.match).toBe(true);
    expect(v.tier).toBe('exacto');
    expect(v.confidence).toBeGreaterThanOrEqual(UMBRALES.EXACTO);
  });

  it('el ruido de marketplace no rompe el match', async () => {
    const v = await matchProducts(
      c('NUEVO Sony WH-1000XM5 Original Sellado Envío Gratis 12 Cuotas', { brand: 'Sony' }),
      c('Sony WH-1000XM5 Brand New In Box', { brand: 'Sony' }),
    );
    expect(v.match).toBe(true);
  });

  it('mismo modelo con tildes y mayúsculas distintas', async () => {
    const v = await matchProducts(
      c('Cámara GoPro HERO12 Black', { brand: 'GoPro' }),
      c('GoPro Hero12 black action camera', { brand: 'GoPro' }),
    );
    expect(v.match).toBe(true);
  });
});

describe('pares que PARECEN iguales pero NO lo son', () => {
  it('128 GB vs 256 GB ⇒ NO es match', async () => {
    const v = await matchProducts(
      c('Apple iPhone 15 128 GB Negro', { brand: 'Apple', capacity: '128 GB' }),
      c('Apple iPhone 15 256GB Black Unlocked', { brand: 'Apple', capacity: '256 GB' }),
    );
    expect(v.match).toBe(false);
    expect(v.reason).toContain('Capacidad distinta');
    expect(v.tier).toBe('similar');
  });

  it('128 GB vs 256 GB detectado sólo desde el título', async () => {
    const v = await matchProducts(
      c('Apple iPhone 15 128GB'),
      c('Apple iPhone 15 256GB'),
    );
    expect(v.match).toBe(false);
    expect(v.reason).toContain('Capacidad');
  });

  it('1 TB vs 512 GB ⇒ NO es match (unidades distintas, mismo eje)', async () => {
    const v = await matchProducts(c('Samsung T7 1TB SSD'), c('Samsung T7 512GB SSD'));
    expect(v.match).toBe(false);
    expect(v.reason).toContain('Capacidad');
  });

  it('iPhone 14 vs iPhone 15 ⇒ NO es match (modelos de distinto año)', async () => {
    const v = await matchProducts(
      c('Apple iPhone 15 128 GB Negro', { brand: 'Apple' }),
      c('Apple iPhone 14 128GB Midnight Unlocked', { brand: 'Apple' }),
    );
    expect(v.match).toBe(false);
    expect(v.reason).toMatch(/Generación|modelo distinto/i);
  });

  it('WH-1000XM4 vs WH-1000XM5 ⇒ NO es match (generación anterior)', async () => {
    const v = await matchProducts(
      c('Sony WH-1000XM5 Negro', { brand: 'Sony' }),
      c('Sony WH-1000XM4 Black', { brand: 'Sony' }),
    );
    expect(v.match).toBe(false);
  });

  it('Kindle Paperwhite 10ma vs 11va generación ⇒ NO es match', async () => {
    const v = await matchProducts(
      c('Amazon Kindle Paperwhite 11va Generación 16 GB', { brand: 'Amazon' }),
      c('Amazon Kindle Paperwhite 10th Generation 16 GB', { brand: 'Amazon' }),
    );
    expect(v.match).toBe(false);
  });

  it('MacBook Air M2 vs M3 ⇒ NO es match', async () => {
    const v = await matchProducts(
      c('Apple MacBook Air 13 M3 256GB', { brand: 'Apple' }),
      c('Apple MacBook Air 13 M2 256GB', { brand: 'Apple' }),
    );
    expect(v.match).toBe(false);
  });

  it('modelo base vs Pro ⇒ NO es match (variante de línea distinta)', async () => {
    const v = await matchProducts(
      c('Apple iPhone 15 128 GB', { brand: 'Apple' }),
      c('Apple iPhone 15 Pro 128GB', { brand: 'Apple' }),
    );
    expect(v.match).toBe(false);
    expect(v.reason).toMatch(/Variante|Generación/i);
  });

  it('genérico compatible que menciona la marca original ⇒ NO es match', async () => {
    const v = await matchProducts(
      c('Auriculares Sony WH-1000XM5 Inalámbricos Negro', { brand: 'Sony' }),
      c('Wireless Noise Cancelling Headphones for Sony WH-1000XM5 Style Black', {
        brand: 'Generic',
      }),
    );
    expect(v.match).toBe(false);
    expect(v.reason).toContain('Marca distinta');
  });

  it('GTIN distinto ⇒ NO es match aunque los títulos sean casi idénticos', async () => {
    const v = await matchProducts(
      c('Apple iPhone 15 Negro', { gtin: '195949036194' }),
      c('Apple iPhone 15 Black', { gtin: '195949036293' }),
    );
    expect(v.match).toBe(false);
    expect(v.method).toBe('gtin');
    expect(v.confidence).toBeGreaterThan(0.9);
  });

  it('el GTIN gana sobre la similitud de título: decide primero', async () => {
    const v = await matchProducts(
      c('iPhone 15 128GB', { gtin: '195949036194', capacity: '128 GB' }),
      c('iPhone 15 256GB', { gtin: '195949036194', capacity: '256 GB' }),
    );
    // Datos contradictorios: el GTIN es la señal más fuerte y manda.
    expect(v.method).toBe('gtin');
    expect(v.match).toBe(true);
  });
});

describe('la banda intermedia: cuando falta información', () => {
  it('mismo modelo pero sólo un lado declara capacidad ⇒ "verificar", no "exacto"', async () => {
    const v = await matchProducts(
      c('Apple iPhone 15 128 GB Negro', { brand: 'Apple', capacity: '128 GB' }),
      c('Apple iPhone 15 Black Unlocked', { brand: 'Apple' }),
    );
    expect(v.match).toBe(true);
    expect(v.tier).toBe('verificar');
    expect(v.confidence).toBeLessThan(UMBRALES.EXACTO);
    expect(v.reason).toContain('capacidad');
  });

  it('sin GTIN ni número de modelo en común ⇒ no afirma match', async () => {
    const v = await matchProducts(
      c('Zapatillas deportivas azules talle 42'),
      c('Blue running sneakers size 9'),
    );
    expect(v.match).toBe(false);
    expect(v.method).toBe('sin-datos');
    expect(v.tier).toBe('similar');
  });

  it('el matcher determinístico devuelve undefined cuando no puede decidir', () => {
    const v = matchDeterministic(
      c('Lámpara de escritorio LED blanca'),
      c('White LED desk lamp'),
    );
    expect(v).toBeUndefined();
  });
});

describe('umbrales asimétricos', () => {
  it('la asimetría es la que pide el brief: sólo ≥ 0,9 se muestra como idéntico', () => {
    expect(UMBRALES.EXACTO).toBe(0.9);
    expect(UMBRALES.VERIFICAR).toBe(0.75);
    expect(tierFor(0.95, true)).toBe('exacto');
    expect(tierFor(0.8, true)).toBe('verificar');
    expect(tierFor(0.6, true)).toBe('similar');
    expect(tierFor(0.99, false)).toBe('similar');
  });

  it('un reason que no nombra ningún atributo no es confiable', () => {
    expect(reasonNombraAtributo('Son el mismo producto, parecen iguales.')).toBe(false);
    expect(reasonNombraAtributo('Mismo modelo WH-1000XM5 y misma capacidad.')).toBe(true);
    expect(reasonNombraAtributo('Capacidad distinta: 128 GB vs 256 GB.')).toBe(true);
  });
});

describe('normalización', () => {
  it('extrae capacidades y normaliza a GB', () => {
    expect(extractCapacidad('iPhone 15 128GB')?.gb).toBe(128);
    expect(extractCapacidad('SSD 1TB')?.gb).toBe(1024);
    expect(extractCapacidad('2 TB externo')?.gb).toBe(2048);
    expect(extractCapacidad('sin capacidad')).toBeUndefined();
  });

  it('con varias capacidades toma la de almacenamiento (la mayor)', () => {
    expect(extractCapacidad('Notebook 8GB RAM 256GB SSD')?.gb).toBe(256);
  });

  it('extrae códigos de modelo', () => {
    expect(extractModelCodes('Sony WH-1000XM5')).toContain('wh1000xm5');
    expect(extractModelCodes('Samsung SM-S918B')).toContain('sms918b');
  });

  it('extrae generaciones de distintas formas de escribirlas', () => {
    expect(extractGeneracion('Apple iPhone 15')).toContain('15');
    expect(extractGeneracion('Sony WH-1000XM5')).toContain('xm5');
    expect(extractGeneracion('MacBook Air M3')).toContain('m3');
    expect(extractGeneracion('Kindle 11va Generación')).toContain('gen11');
    expect(extractGeneracion('Kindle 11th Generation')).toContain('gen11');
  });

  it('extrae la variante de línea', () => {
    expect(extractVariante('iPhone 15 Pro Max')).toBe('pro max');
    expect(extractVariante('iPhone 15')).toBeUndefined();
    expect(extractVariante('Galaxy S24 Ultra')).toBe('ultra');
  });

  it('normaliza GTIN y descarta los de largo inválido', () => {
    expect(normalizeGtin('027242923072')).toBe('0027242923072');
    expect(normalizeGtin('0027242923072')).toBe('0027242923072');
    expect(normalizeGtin('123')).toBeUndefined();
    expect(normalizeGtin(undefined)).toBeUndefined();
  });

  it('saca tildes y ruido de marketplace', () => {
    const n = normalizeText('NUEVO Cámara Original Sellado Envío Gratis');
    expect(n).not.toContain('á');
    expect(n).not.toContain('nuevo');
    expect(n).toContain('camara');
  });
});
