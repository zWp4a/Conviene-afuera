import { describe, expect, it } from 'vitest';
import { isMLUrl, MLReaderError, parseMLUrl, readMLProduct } from '@/modules/ml-reader';
import { MemoryCache } from '@/lib/cache';

describe('parseMLUrl — links válidos', () => {
  it('link de artículo clásico', () => {
    const r = parseMLUrl(
      'https://articulo.mercadolibre.com.uy/MLU-123456789-apple-iphone-15-128-gb-negro-_JM',
    );
    expect(r.itemId).toBe('MLU123456789');
    expect(r.esCatalogo).toBe(false);
  });

  it('link de catálogo /p/', () => {
    const r = parseMLUrl('https://www.mercadolibre.com.uy/p/MLU12345678');
    expect(r.itemId).toBe('MLU12345678');
    expect(r.esCatalogo).toBe(true);
    expect(r.canonicalUrl).toBe('https://www.mercadolibre.com.uy/p/MLU12345678');
  });

  it('link de catálogo con path adicional y variante', () => {
    const r = parseMLUrl(
      'https://www.mercadolibre.com.uy/apple-iphone-15/p/MLU12345678?variation=987654',
    );
    expect(r.itemId).toBe('MLU12345678');
    expect(r.variationId).toBe('987654');
  });

  it('descarta el query string de tracking', () => {
    const r = parseMLUrl(
      'https://articulo.mercadolibre.com.uy/MLU-123456789-cosa-_JM?matt_tool=12345&quantity=1#reviews',
    );
    expect(r.itemId).toBe('MLU123456789');
    expect(r.canonicalUrl).not.toContain('matt_tool');
  });

  it('acepta el id sin guión', () => {
    expect(parseMLUrl('https://articulo.mercadolibre.com.uy/MLU123456789').itemId).toBe(
      'MLU123456789',
    );
  });

  it('acepta el link sin protocolo', () => {
    expect(parseMLUrl('articulo.mercadolibre.com.uy/MLU-123456789-x-_JM').itemId).toBe(
      'MLU123456789',
    );
  });

  it('tolera espacios al pegar', () => {
    expect(parseMLUrl('  https://www.mercadolibre.com.uy/p/MLU12345678  ').itemId).toBe(
      'MLU12345678',
    );
  });
});

describe('parseMLUrl — errores con mensaje para el usuario', () => {
  it('texto vacío', () => {
    expect(() => parseMLUrl('')).toThrowError(MLReaderError);
  });

  it('no es una URL', () => {
    try {
      parseMLUrl('esto no es un link');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(MLReaderError);
      expect((e as MLReaderError).code).toBe('URL_INVALIDA');
    }
  });

  it('Mercado Libre de otro país: error específico, no genérico', () => {
    try {
      parseMLUrl('https://articulo.mercadolibre.com.ar/MLA-123456789-cosa-_JM');
      expect.unreachable();
    } catch (e) {
      expect((e as MLReaderError).code).toBe('NO_ES_MERCADOLIBRE_UY');
      expect((e as MLReaderError).userMessage).toContain('otro país');
    }
  });

  it('Mercado Livre Brasil', () => {
    expect(() => parseMLUrl('https://produto.mercadolivre.com.br/MLB-123456789-x')).toThrowError(
      MLReaderError,
    );
  });

  it('otro sitio cualquiera', () => {
    try {
      parseMLUrl('https://www.amazon.com/dp/B0CHX1W1XY');
      expect.unreachable();
    } catch (e) {
      expect((e as MLReaderError).code).toBe('NO_ES_MERCADOLIBRE_UY');
    }
  });

  it('home de ML sin producto', () => {
    try {
      parseMLUrl('https://www.mercadolibre.com.uy/');
      expect.unreachable();
    } catch (e) {
      expect((e as MLReaderError).code).toBe('URL_INVALIDA');
      expect((e as MLReaderError).userMessage).toContain('página del producto');
    }
  });

  it('isMLUrl no tira: sirve para validar en la UI', () => {
    expect(isMLUrl('https://www.mercadolibre.com.uy/p/MLU12345678')).toBe(true);
    expect(isMLUrl('cualquier cosa')).toBe(false);
  });
});

describe('readMLProduct con mocks', () => {
  it('devuelve un producto para cualquier link válido', async () => {
    const p = await readMLProduct('https://www.mercadolibre.com.uy/p/MLU999999999', {
      cache: new MemoryCache(),
      forceMock: true,
    });
    expect(p.source).toBe('mock');
    expect(p.title.length).toBeGreaterThan(0);
    expect(p.price.cents).toBeGreaterThan(0);
  });

  it('devuelve el mock exacto cuando el id coincide', async () => {
    const p = await readMLProduct(
      'https://articulo.mercadolibre.com.uy/MLU-987654321-sony-_JM',
      { cache: new MemoryCache(), forceMock: true },
    );
    expect(p.attributes.model).toBe('WH-1000XM5');
  });

  it('cachea: la segunda llamada devuelve el mismo objeto', async () => {
    const cache = new MemoryCache();
    const url = 'https://www.mercadolibre.com.uy/p/MLU12345678';
    const a = await readMLProduct(url, { cache, forceMock: true });
    const b = await readMLProduct(url, { cache, forceMock: true });
    expect(b).toBe(a);
  });
});
