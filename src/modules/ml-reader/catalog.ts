/**
 * API DE CATÁLOGO DE MERCADO LIBRE
 * =================================
 * Por qué el catálogo y no `/items`: verificado el 2026-11-07, `/items/{id}`
 * devuelve 403 `access_denied` para publicaciones ajenas cuando la app no
 * está certificada. La documentación todavía lo describe como público, pero
 * no lo es. El catálogo sí está abierto:
 *
 *   /products/search    buscar productos del catálogo de MLU
 *   /products/{id}      76 atributos: marca, modelo, capacidad, color...
 *   /products/{id}/items  las publicaciones activas con su precio
 *
 * Efecto secundario deseable: comparamos contra el precio MÁS BARATO del
 * catálogo en Uruguay, no contra una publicación suelta que puede estar
 * sobrevalorada. Es la comparación más honesta.
 */
import { z } from 'zod';
import { mlCatalogItemsSchema, mlCatalogProductSchema, mlCatalogSearchSchema } from './schema';
import { MLReaderError } from './types';
import { getAccessToken } from './auth';

const BASE = 'https://api.mercadolibre.com';
const TIMEOUT_MS = 8000;
const SITE = 'MLU';

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

function errorDeRespuesta(status: number): MLReaderError {
  if (status === 401 || status === 403) {
    return new MLReaderError(
      'SIN_CREDENCIALES',
      'Mercado Libre rechazó nuestras credenciales o nuestros permisos. Hay que revisar la configuración de la app.',
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

async function parsear<T extends z.ZodTypeAny>(res: Response, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    throw new MLReaderError(
      'API_NO_DISPONIBLE',
      'Mercado Libre devolvió los datos en un formato que no reconocemos.',
      parsed.error.message.slice(0, 300),
    );
  }
  return parsed.data;
}

export type CatalogSearchResult = z.infer<typeof mlCatalogSearchSchema>['results'][number];
export type CatalogProduct = z.infer<typeof mlCatalogProductSchema>;
export type CatalogListing = z.infer<typeof mlCatalogItemsSchema>['results'][number];

/** Busca productos en el catálogo de MLU. */
export async function searchCatalog(q: string, limit = 10): Promise<readonly CatalogSearchResult[]> {
  const params = new URLSearchParams({ status: 'active', site_id: SITE, q, limit: String(limit) });
  const res = await get(`/products/search?${params}`);
  if (!res.ok) throw errorDeRespuesta(res.status);
  return (await parsear(res, mlCatalogSearchSchema)).results;
}

/** Ficha completa de un producto del catálogo. */
export async function fetchCatalogProduct(productId: string): Promise<CatalogProduct> {
  const res = await get(`/products/${productId}`);
  if (res.status === 404) {
    throw new MLReaderError(
      'ITEM_NO_ENCONTRADO',
      'No encontramos ese producto en el catálogo de Mercado Libre.',
    );
  }
  if (!res.ok) throw errorDeRespuesta(res.status);
  return parsear(res, mlCatalogProductSchema);
}

/** Publicaciones activas de un producto, con su precio. */
export async function fetchCatalogListings(productId: string): Promise<readonly CatalogListing[]> {
  const res = await get(`/products/${productId}/items`);
  if (res.status === 404) return [];
  if (!res.ok) throw errorDeRespuesta(res.status);
  return (await parsear(res, mlCatalogItemsSchema)).results;
}
