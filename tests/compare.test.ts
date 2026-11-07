/**
 * TEST END-TO-END CON MOCKS
 * ==========================
 * Recorre el flujo completo sin red: ml-reader → foreign-search → matcher →
 * landed-cost → advisor. Es el test que verifica que los módulos encajan.
 */
import { describe, expect, it } from 'vitest';
import { MemoryCache } from '@/lib/cache';
import { compare } from '@/modules/compare';

const URL_IPHONE = 'https://articulo.mercadolibre.com.uy/MLU-123456789-apple-iphone-15-128-gb-negro-_JM';
const URL_SONY = 'https://articulo.mercadolibre.com.uy/MLU-987654321-sony-wh-1000xm5-_JM';

describe('flujo completo con datos mock', () => {
  it('devuelve un veredicto y opciones para el iPhone', async () => {
    const r = await compare({ url: URL_IPHONE }, { cache: new MemoryCache() });
    expect(r.usandoDatosMock).toBe(true);
    expect(r.opciones.length).toBeGreaterThan(0);
    expect(r.veredicto.id).toBeDefined();
    expect(r.veredicto.disclaimer).toContain('aduanas.gub.uy');
  });

  it('el match exacto del iPhone 15 128 GB es el de 128 GB, no el de 256', async () => {
    const r = await compare({ url: URL_IPHONE }, { cache: new MemoryCache() });
    const exactos = r.opciones.filter((o) => o.match.tier === 'exacto');
    expect(exactos.length).toBeGreaterThan(0);
    for (const o of exactos) {
      expect(o.offer.title).toContain('128');
      expect(o.offer.title).not.toContain('256');
    }
  });

  it('el iPhone 14 y el de 256 GB quedan como "similares", no como match', async () => {
    const r = await compare({ url: URL_IPHONE }, { cache: new MemoryCache() });
    const ip14 = r.opciones.find((o) => o.offer.title.includes('iPhone 14'));
    const ip256 = r.opciones.find((o) => o.offer.title.includes('256GB'));
    expect(ip14?.match.tier).toBe('similar');
    expect(ip256?.match.tier).toBe('similar');
  });

  it('el genérico que imita al Sony no se compara contra el original', async () => {
    const r = await compare({ url: URL_SONY }, { cache: new MemoryCache() });
    const generico = r.opciones.find((o) => o.offer.title.includes('Style'));
    expect(generico?.match.tier).toBe('similar');
    expect(generico?.match.reason).toContain('Marca distinta');
    // Y por lo tanto no puede ser la mejor opción del veredicto.
    expect(r.veredicto.mejorOpcion?.offer.externalId).not.toBe('MOCK-GEN-ANC');
  });

  it('el veredicto sólo compara contra matches confiables', async () => {
    const r = await compare({ url: URL_SONY }, { cache: new MemoryCache() });
    if (r.veredicto.mejorOpcion) {
      expect(['exacto', 'verificar']).toContain(r.veredicto.mejorOpcion.match.tier);
    }
  });

  it('cada opción trae los dos regímenes calculados', async () => {
    const r = await compare({ url: URL_IPHONE }, { cache: new MemoryCache() });
    for (const o of r.opciones) {
      expect(o.costo.franquicia).toBeDefined();
      expect(o.costo.simplificado).toBeDefined();
    }
  });

  it('con el cupo agotado recalcula y recomienda simplificado', async () => {
    const sinCupo = await compare(
      {
        url: URL_SONY,
        franquicia: { enviosUsados: 3, cupoUsadoUsd: 800, asumido: false },
      },
      { cache: new MemoryCache() },
    );
    const mejor = sinCupo.veredicto.mejorOpcion;
    expect(mejor?.costo.franquicia.applicable).toBe(false);
    expect(mejor?.costo.recomendado?.regime).toBe('simplificado');
  });

  it('sin cupo sale más caro que con cupo disponible', async () => {
    const conCupo = await compare({ url: URL_SONY }, { cache: new MemoryCache() });
    const sinCupo = await compare(
      { url: URL_SONY, franquicia: { enviosUsados: 3, cupoUsadoUsd: 800, asumido: false } },
      { cache: new MemoryCache() },
    );
    const a = conCupo.veredicto.mejorOpcion?.totalUyu.cents ?? 0;
    const b = sinCupo.veredicto.mejorOpcion?.totalUyu.cents ?? 0;
    expect(b).toBeGreaterThan(a);
  });

  it('cuando conviene afuera, la guía tiene pasos concretos', async () => {
    const r = await compare({ url: URL_SONY }, { cache: new MemoryCache() });
    if (r.veredicto.id === 'conviene-afuera') {
      expect(r.veredicto.guia.length).toBeGreaterThanOrEqual(4);
      expect(r.veredicto.guia.map((p) => p.titulo).join(' ')).toMatch(/cuenta/i);
      expect(r.veredicto.perdidas.length).toBeGreaterThan(0);
      expect(r.veredicto.perdidas.join(' ')).toMatch(/[Gg]arantía/);
    }
  });

  it('el link inválido falla con un error pensado para el usuario', async () => {
    await expect(
      compare({ url: 'https://www.amazon.com/dp/B0CHX1W1XY' }, { cache: new MemoryCache() }),
    ).rejects.toThrowError(/mercadolibre\.com\.uy/i);
  });
});
