/**
 * PARSEO DE LINKS DE MERCADO LIBRE URUGUAY
 * =========================================
 * Valida que el link sea de mercadolibre.com.uy y extrae el item id.
 *
 * Formatos que soporta:
 *   https://articulo.mercadolibre.com.uy/MLU-123456789-nombre-del-producto-_JM
 *   https://www.mercadolibre.com.uy/p/MLU12345678                (catálogo)
 *   https://www.mercadolibre.com.uy/algo/p/MLU12345678?var=123
 *   https://articulo.mercadolibre.com.uy/MLU123456789             (sin guión)
 *   ...con cualquier query string de tracking, que se descarta.
 */
import { MLReaderError } from './types';

const HOSTS_VALIDOS = new Set([
  'mercadolibre.com.uy',
  'www.mercadolibre.com.uy',
  'articulo.mercadolibre.com.uy',
  'produto.mercadolibre.com.uy',
]);

/** Hosts de Mercado Libre de otros países: error específico, no genérico. */
const HOSTS_ML_OTRO_PAIS = /\.mercadolibre\.com(\.[a-z]{2})?$|\.mercadolivre\.com(\.br)?$/i;

export interface ParsedMLUrl {
  /** Item id normalizado, siempre sin guión: "MLU123456789". */
  readonly itemId: string;
  /** `true` si el link es de una página de catálogo (/p/MLUxxxx). */
  readonly esCatalogo: boolean;
  /** URL canónica, sin query string de tracking. */
  readonly canonicalUrl: string;
  /** Variante seleccionada en la URL, si viene. */
  readonly variationId?: string;
}

const RE_ITEM_PATH = /\bMLU-?(\d{6,})\b/i;

export function parseMLUrl(input: string): ParsedMLUrl {
  const raw = input.trim();
  if (raw === '') {
    throw new MLReaderError('URL_INVALIDA', 'Pegá un link de Mercado Libre para empezar.');
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    throw new MLReaderError(
      'URL_INVALIDA',
      'Eso no parece un link. Copiá la dirección completa de la página del producto.',
    );
  }

  const host = url.hostname.toLowerCase();
  if (!HOSTS_VALIDOS.has(host)) {
    if (HOSTS_ML_OTRO_PAIS.test(host)) {
      throw new MLReaderError(
        'NO_ES_MERCADOLIBRE_UY',
        'Ese link es de Mercado Libre de otro país. Por ahora sólo comparamos productos de mercadolibre.com.uy.',
      );
    }
    throw new MLReaderError(
      'NO_ES_MERCADOLIBRE_UY',
      'El link tiene que ser de mercadolibre.com.uy.',
    );
  }

  const match = RE_ITEM_PATH.exec(url.pathname);
  if (!match?.[1]) {
    throw new MLReaderError(
      'URL_INVALIDA',
      'No pude encontrar el producto en ese link. Asegurate de copiarlo desde la página del producto y no desde una lista de resultados.',
    );
  }

  const itemId = `MLU${match[1]}`;
  const esCatalogo = /\/p\/MLU/i.test(url.pathname);
  const variationId = url.searchParams.get('variation') ?? undefined;

  const canonicalUrl = esCatalogo
    ? `https://www.mercadolibre.com.uy/p/${itemId}`
    : `https://articulo.mercadolibre.com.uy/${itemId.replace(/^MLU/, 'MLU-')}-_JM`;

  return { itemId, esCatalogo, canonicalUrl, ...(variationId ? { variationId } : {}) };
}

/** Versión que no tira: útil para validar el input en la UI. */
export function isMLUrl(input: string): boolean {
  try {
    parseMLUrl(input);
    return true;
  } catch {
    return false;
  }
}
