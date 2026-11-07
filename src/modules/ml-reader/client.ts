/**
 * CLIENTE DE LA API DE MERCADO LIBRE
 * ===================================
 * Dos endpoints, según qué tipo de link pegó el usuario:
 *
 *   /items/{id}      para links de artículo (articulo.mercadolibre.com.uy/MLU-...)
 *   /products/{id}   para links de catálogo (mercadolibre.com.uy/p/MLU...)
 *
 * El id tiene la misma forma en los dos casos, así que no se puede distinguir
 * por el id: lo decide `parseMLUrl` mirando el path. Si el endpoint elegido
 * devuelve 404, probamos el otro antes de darnos por vencidos — hay links que
 * redirigen entre una forma y la otra.
 */
import { getAccessToken } from './auth';
import { mapCatalogProduct, mapItem } from './mapper';
import { mlItemSchema, mlProductSchema } from './schema';
import type { ParsedMLUrl } from './parse-url';
import { MLReaderError, type MLProduct } from './types';

const BASE = 'https://api.mercadolibre.com';
const TIMEOUT_MS = 8000;

async function get(path: string): Promise<Response> {
  const token = await getAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${path}`, {
      signal: controller.signal,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MLReaderError(
        'API_NO_DISPONIBLE',
        'Mercado Libre está tardando demasiado en responder. Probá de nuevo en un rato.',
      );
    }
    throw new MLReaderError(
      'API_NO_DISPONIBLE',
      'No pudimos conectarnos con Mercado Libre. Probá de nuevo en un rato.',
      error,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function fetchComoItem(itemId: string, url: string): Promise<MLProduct | 'no-existe'> {
  const res = await get(`/items/${itemId}`);
  if (res.status === 404) return 'no-existe';
  if (!res.ok) throw errorDeRespuesta(res.status);
  const parsed = mlItemSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new MLReaderError(
      'API_NO_DISPONIBLE',
      'Mercado Libre devolvió el producto en un formato que no reconocemos.',
      parsed.error.message.slice(0, 300),
    );
  }
  return mapItem(parsed.data, url);
}

async function fetchComoCatalogo(productId: string, url: string): Promise<MLProduct | 'no-existe'> {
  const res = await get(`/products/${productId}`);
  if (res.status === 404) return 'no-existe';
  if (!res.ok) throw errorDeRespuesta(res.status);
  const parsed = mlProductSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new MLReaderError(
      'API_NO_DISPONIBLE',
      'Mercado Libre devolvió el producto en un formato que no reconocemos.',
      parsed.error.message.slice(0, 300),
    );
  }
  return mapCatalogProduct(parsed.data, url);
}

function errorDeRespuesta(status: number): MLReaderError {
  if (status === 401 || status === 403) {
    return new MLReaderError(
      'SIN_CREDENCIALES',
      'Mercado Libre rechazó nuestras credenciales. Hay que revisar la configuración de la app.',
    );
  }
  if (status === 429) {
    return new MLReaderError(
      'API_NO_DISPONIBLE',
      'Mercado Libre nos está limitando por exceso de consultas. Probá de nuevo en unos minutos.',
    );
  }
  return new MLReaderError(
    'API_NO_DISPONIBLE',
    'Mercado Libre no está respondiendo bien en este momento. Probá de nuevo en un rato.',
  );
}

export async function fetchProduct(parsed: ParsedMLUrl): Promise<MLProduct> {
  const { itemId, canonicalUrl, esCatalogo } = parsed;

  const primero = esCatalogo
    ? await fetchComoCatalogo(itemId, canonicalUrl)
    : await fetchComoItem(itemId, canonicalUrl);
  if (primero !== 'no-existe') return primero;

  // El link decía una cosa y la API dice otra: probamos el otro endpoint.
  const segundo = esCatalogo
    ? await fetchComoItem(itemId, canonicalUrl)
    : await fetchComoCatalogo(itemId, canonicalUrl);
  if (segundo !== 'no-existe') return segundo;

  throw new MLReaderError(
    'ITEM_NO_ENCONTRADO',
    'No encontramos ese producto en Mercado Libre. Puede que la publicación se haya dado de baja.',
  );
}
