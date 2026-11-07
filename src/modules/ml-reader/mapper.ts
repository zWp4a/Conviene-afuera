/**
 * MAPEO DE LA API DE ML A NUESTRO DOMINIO
 * ========================================
 * La parte importante es extraer bien los atributos: de acá sale el GTIN que
 * le ahorra una llamada al LLM al matcher, y la capacidad que evita que
 * comparemos un 128 GB contra un 256 GB.
 *
 * ML usa ids de atributo estandarizados, pero no todos los vendedores los
 * cargan: por eso cada campo tiene varios ids candidatos y un fallback.
 */
import { fromUnits, type Currency, type Money } from '@/lib/money';
import type { CatalogListing, CatalogProduct } from './catalog';
import type { MLItemRaw, MLProductRaw } from './schema';
import type { MLProduct, ProductAttributes } from './types';

/** Ids de atributo de ML, en orden de preferencia. */
const IDS = {
  brand: ['BRAND', 'MANUFACTURER'],
  model: ['MODEL', 'ALPHANUMERIC_MODEL', 'LINE'],
  gtin: ['GTIN', 'EAN', 'UPC'],
  capacity: ['INTERNAL_MEMORY', 'CAPACITY', 'STORAGE_CAPACITY', 'RAM', 'VOLUME_CAPACITY'],
  color: ['COLOR', 'MAIN_COLOR'],
  weight: ['WEIGHT', 'PACKAGE_WEIGHT', 'NET_WEIGHT', 'UNIT_WEIGHT'],
} as const;

type Attr = { id: string; name?: string | undefined; value_name?: string | null | undefined };

function pick(attrs: readonly Attr[], ids: readonly string[]): string | undefined {
  for (const id of ids) {
    const found = attrs.find((a) => a.id === id && a.value_name);
    if (found?.value_name) return found.value_name.trim();
  }
  return undefined;
}

/** "1.2 kg", "350 g", "1200 gr" → gramos. */
export function parseWeightToGrams(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|grs|gramos|lb|oz)\b/i.exec(raw.toLowerCase());
  if (!m?.[1] || !m[2]) return undefined;
  const n = Number.parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  switch (m[2].toLowerCase()) {
    case 'kg':
    case 'kgs':
      return Math.round(n * 1000);
    case 'lb':
      return Math.round(n * 453.592);
    case 'oz':
      return Math.round(n * 28.3495);
    default:
      return Math.round(n);
  }
}

function mapCondition(c: string | undefined): MLProduct['condition'] {
  switch (c) {
    case 'new':
      return 'new';
    case 'used':
      return 'used';
    case 'refurbished':
      return 'refurbished';
    default:
      return 'unknown';
  }
}

function mapCurrency(c: string | null | undefined): Currency {
  // ML usa UYU y USD en el site MLU. Cualquier otra cosa la tratamos como UYU
  // y el precio queda evidentemente mal, lo cual es mejor que fallar en silencio.
  return c === 'USD' ? 'USD' : 'UYU';
}

export function mapAttributes(attrs: readonly Attr[]): ProductAttributes {
  const extra: Record<string, string> = {};
  for (const a of attrs) {
    if (a.name && a.value_name) extra[a.name] = a.value_name;
  }

  const brand = pick(attrs, IDS.brand);
  const model = pick(attrs, IDS.model);
  const gtin = pick(attrs, IDS.gtin);
  const capacity = pick(attrs, IDS.capacity);
  const color = pick(attrs, IDS.color);

  return {
    ...(brand ? { brand } : {}),
    ...(model ? { model } : {}),
    ...(gtin ? { gtin } : {}),
    ...(capacity ? { capacity } : {}),
    ...(color ? { color } : {}),
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
}

export function mapItem(raw: MLItemRaw, fallbackUrl: string): MLProduct {
  const attrs = raw.attributes ?? [];
  const price: Money = fromUnits(raw.price ?? 0, mapCurrency(raw.currency_id));
  const weightGrams = parseWeightToGrams(pick(attrs, IDS.weight));

  const images = (raw.pictures ?? [])
    .map((p) => p.secure_url)
    .filter((u): u is string => Boolean(u));
  if (images.length === 0 && raw.thumbnail) images.push(raw.thumbnail);

  return {
    id: raw.id,
    url: raw.permalink ?? fallbackUrl,
    title: raw.title,
    price,
    attributes: mapAttributes(attrs),
    ...(weightGrams ? { weightGrams } : {}),
    categoryId: raw.category_id ?? '',
    condition: mapCondition(raw.condition),
    seller: {
      id: raw.seller_id ?? 0,
      esTiendaOficial: Boolean(raw.official_store_id),
    },
    shipping: {
      envioGratis: Boolean(raw.shipping?.free_shipping),
      esFull: raw.shipping?.logistic_type === 'fulfillment',
    },
    images,
    ...(raw.warranty ? { warrantyText: raw.warranty } : {}),
    source: 'api',
    priceSource: 'catalogo',
  };
}

export function mapCatalogProduct(raw: MLProductRaw, fallbackUrl: string): MLProduct {
  const attrs = raw.attributes ?? [];
  const bb = raw.buy_box_winner;
  const weightGrams = parseWeightToGrams(pick(attrs, IDS.weight));

  const images = (raw.pictures ?? [])
    .map((p) => p.secure_url ?? p.url)
    .filter((u): u is string => Boolean(u));

  return {
    id: raw.id,
    url: fallbackUrl,
    title: raw.name ?? raw.id,
    price: fromUnits(bb?.price ?? 0, mapCurrency(bb?.currency_id)),
    attributes: mapAttributes(attrs),
    ...(weightGrams ? { weightGrams } : {}),
    categoryId: raw.category_id ?? '',
    condition: 'new',
    seller: { id: bb?.seller_id ?? 0, esTiendaOficial: false },
    shipping: { envioGratis: Boolean(bb?.shipping?.free_shipping), esFull: false },
    images,
    ...(bb?.warranty ? { warrantyText: bb.warranty } : {}),
    source: 'api',
    priceSource: 'catalogo',
  };
}


/* ──────────────────────────────────────────────────────────────────────────
 * CATÁLOGO
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Publicación más barata entre las activas. Es la que usamos para comparar:
 * si el producto está más barato afuera que la mejor oferta de Uruguay,
 * entonces sí conviene traerlo.
 */
export function listingMasBarata(
  listings: readonly CatalogListing[],
): CatalogListing | undefined {
  const validas = listings.filter((l) => typeof l.price === 'number' && l.price > 0);
  if (validas.length === 0) return undefined;
  // No se pueden comparar precios en monedas distintas sin cotización, y acá
  // no la tenemos: preferimos las de USD si las hay, si no las de UYU.
  const usdOnly = validas.filter((l) => l.currency_id === 'USD');
  const pool = usdOnly.length > 0 ? usdOnly : validas;
  return pool.reduce((a, b) => ((b.price ?? 0) < (a.price ?? 0) ? b : a));
}

/** Combina la ficha del catálogo con su publicación más barata. */
export function mapCatalog(
  product: CatalogProduct,
  listings: readonly CatalogListing[],
  url: string,
  precioManual?: Money,
): MLProduct {
  const attrs = product.attributes ?? [];
  const mejor = listingMasBarata(listings);
  const weightGrams = parseWeightToGrams(pick(attrs, IDS.weight));

  const images = (product.pictures ?? [])
    .map((p) => p.secure_url ?? p.url)
    .filter((u): u is string => Boolean(u));

  return {
    id: product.id,
    url: product.permalink || url,
    title: product.name,
    price: precioManual ?? fromUnits(mejor?.price ?? 0, mapCurrency(mejor?.currency_id)),
    attributes: mapAttributes(attrs),
    ...(weightGrams ? { weightGrams } : {}),
    categoryId: mejor?.category_id ?? '',
    condition: mapCondition(mejor?.condition ?? undefined),
    seller: {
      id: mejor?.seller_id ?? 0,
      esTiendaOficial: Boolean(mejor?.official_store_id),
    },
    shipping: {
      envioGratis: Boolean(mejor?.shipping?.free_shipping),
      esFull: mejor?.shipping?.logistic_type === 'fulfillment',
    },
    images,
    ...(mejor?.warranty ? { warrantyText: mejor.warranty } : {}),
    source: 'api',
    priceSource: precioManual ? 'usuario' : 'catalogo',
  };
}
