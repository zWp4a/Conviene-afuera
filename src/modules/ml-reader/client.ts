/**
 * RESOLUCIÓN DE UN LINK DE ML A UN PRODUCTO
 * ==========================================
 * Dos caminos, según qué pegó el usuario:
 *
 *   /p/MLU12345678          → el id ES el del catálogo. Directo.
 *   /MLU-123456789-titulo   → el id es de una publicación, y `/items/{id}`
 *                             está cerrado para apps no certificadas. Pero el
 *                             título viene en el slug de la URL: lo buscamos
 *                             en el catálogo y elegimos con el matcher.
 *
 * Lo segundo no es scraping: el título está en el texto que el usuario pegó.
 *
 * Nota de arquitectura: este módulo importa `matcher`, que es la única
 * dependencia entre módulos del proyecto. Se justifica porque elegir el
 * producto correcto de una lista de resultados ES un problema de matching, y
 * porque la parte que usamos es pura — sin red, sin LLM y sin costo.
 */
import type { Money } from '@/lib/money';
import { matchDeterministic, tokenSimilarity } from '@/modules/matcher';
import { fetchCatalogListings, fetchCatalogProduct, searchCatalog, type CatalogSearchResult } from './catalog';
import { mapAttributes, mapCatalog } from './mapper';
import type { ParsedMLUrl } from './parse-url';
import { MLReaderError, type MLProduct } from './types';

/** Debajo de esto no nos arriesgamos a afirmar que es el mismo producto. */
const SIMILITUD_MINIMA = 0.35;

export interface ResolucionCatalogo {
  readonly productId: string;
  readonly confianza: number;
  readonly motivo: string;
}

/**
 * Elige cuál de los resultados del catálogo es el producto del link.
 *
 * Acá se juega la calidad del `ml-reader`: buscando "sony wh 1000xm5" el
 * primer resultado del catálogo es un ACCESORIO para esos auriculares, no los
 * auriculares. Por eso no tomamos el primero: lo pasamos por el matcher, que
 * descarta por marca, capacidad y generación.
 */
export function elegirDelCatalogo(
  titulo: string,
  resultados: readonly CatalogSearchResult[],
): ResolucionCatalogo | undefined {
  return rankearCatalogo(titulo, resultados)[0];
}

/**
 * Todos los candidatos aceptables, del mejor al peor.
 *
 * Devolvemos varios y no uno solo porque un producto del catálogo puede
 * existir pero no tener ninguna publicación activa: en ese caso el precio
 * sería 0 y el veredicto, un disparate. El llamador va probando en orden
 * hasta encontrar uno que realmente esté a la venta.
 */
export function rankearCatalogo(
  titulo: string,
  resultados: readonly CatalogSearchResult[],
): readonly ResolucionCatalogo[] {
  const base = { title: titulo };

  const puntuados = resultados.map((r) => {
    const candidato = { title: r.name, ...mapAttributes(r.attributes ?? []) };
    const veredicto = matchDeterministic(base, candidato);
    const similitud = tokenSimilarity(titulo, r.name);

    // Un descarte del matcher (marca distinta, capacidad distinta) es
    // definitivo: lo sacamos de carrera aunque el título se parezca mucho.
    if (veredicto && !veredicto.match) {
      return { r, score: -1, motivo: veredicto.reason };
    }
    const score = veredicto?.match ? Math.max(veredicto.confidence, similitud) : similitud;
    return { r, score, motivo: veredicto?.reason ?? `Similitud de título ${Math.round(similitud * 100)}%.` };
  });

  return puntuados
    .filter((p) => p.score >= SIMILITUD_MINIMA)
    .sort((a, b) => b.score - a.score)
    .map((p) => ({
      productId: p.r.id,
      confianza: Math.round(p.score * 100) / 100,
      motivo: p.motivo,
    }));
}

async function desdeProductId(
  productId: string,
  url: string,
  precioManual?: Money,
): Promise<MLProduct> {
  const [product, listings] = await Promise.all([
    fetchCatalogProduct(productId),
    fetchCatalogListings(productId),
  ]);
  return mapCatalog(product, listings, url, precioManual);
}

/** `true` si el producto tiene un precio real con el que se pueda comparar. */
function tienePrecio(p: MLProduct): boolean {
  return p.price.cents > 0;
}

/** Cuántos candidatos probamos antes de rendirnos. Cada uno son 2 requests. */
const MAX_CANDIDATOS = 3;

export async function fetchProduct(
  parsed: ParsedMLUrl,
  precioManual?: Money,
): Promise<MLProduct> {
  const { itemId, canonicalUrl, esCatalogo, tituloDelSlug } = parsed;

  // Caso fácil: el link ya trae el id del catálogo.
  if (esCatalogo) return desdeProductId(itemId, canonicalUrl, precioManual);

  // Caso de publicación: el id no nos sirve, el título del slug sí.
  if (!tituloDelSlug) {
    throw new MLReaderError(
      'ITEM_NO_ENCONTRADO',
      'Ese link no trae el nombre del producto. Copiá el link desde la página del producto en Mercado Libre, no desde una lista de resultados ni desde un acortador.',
    );
  }

  const resultados = await searchCatalog(tituloDelSlug);
  if (resultados.length === 0) {
    throw new MLReaderError(
      'ITEM_NO_ENCONTRADO',
      'No encontramos ese producto en el catálogo de Mercado Libre Uruguay. Puede ser una publicación sin ficha de catálogo.',
    );
  }

  const candidatos = rankearCatalogo(tituloDelSlug, resultados);
  if (candidatos.length === 0) {
    throw new MLReaderError(
      'ITEM_NO_ENCONTRADO',
      'Encontramos productos parecidos pero ninguno que sea claramente el del link. Preferimos no comparar antes que comparar el producto equivocado.',
    );
  }

  // Si la persona ya nos dio el precio, no hace falta buscar uno que sirva:
  // con el primer candidato bien matcheado alcanza.
  if (precioManual) {
    return desdeProductId(candidatos[0]!.productId, canonicalUrl, precioManual);
  }

  // Un producto del catálogo puede existir sin publicaciones activas. Sin
  // precio no hay nada que comparar, así que seguimos con el siguiente.
  for (const candidato of candidatos.slice(0, MAX_CANDIDATOS)) {
    const producto = await desdeProductId(candidato.productId, canonicalUrl);
    if (tienePrecio(producto)) return producto;
  }

  throw new MLReaderError(
    'PRECIO_NO_DISPONIBLE',
    'Identificamos el producto, pero Mercado Libre no nos deja ver su precio. Escribilo vos y seguimos.',
  );
}
