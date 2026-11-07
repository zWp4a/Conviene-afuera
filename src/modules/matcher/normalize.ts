/**
 * NORMALIZACIÓN DE TÍTULOS Y ATRIBUTOS
 * =====================================
 * Extrae señales duras de títulos sucios. Es la base del matcher
 * determinístico: lo que se resuelve acá no gasta una llamada al LLM.
 */

/** Ruido de marketplace que no aporta a la identidad del producto. */
const RUIDO = [
  'nuevo', 'new', 'original', 'oficial', 'official', 'sellado', 'sealed',
  'envio gratis', 'free shipping', 'unlocked', 'libre', 'liberado',
  'en caja', 'in box', 'garantia', 'warranty', 'cuotas', 'oferta',
  'promo', 'descuento', 'importado', 'genuine', 'brand new',
];

export function normalizeText(s: string): string {
  let out = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes
    .replace(/[^a-z0-9+\s.-]/g, ' ');
  for (const r of RUIDO) out = out.replaceAll(r, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/** Capacidad de almacenamiento o memoria, normalizada a GB. */
export interface Capacidad {
  readonly gb: number;
  readonly raw: string;
}

const RE_CAPACIDAD = /(\d+(?:[.,]\d+)?)\s*(tb|gb|mb)\b/gi;

export function extractCapacidad(s: string): Capacidad | undefined {
  const texto = s.toLowerCase();
  const matches = [...texto.matchAll(RE_CAPACIDAD)];
  if (matches.length === 0) return undefined;

  // Si hay varias (ej: "8GB RAM 256GB"), tomamos la mayor: es la de
  // almacenamiento, que es la que distingue variantes de precio.
  let mejor: Capacidad | undefined;
  for (const m of matches) {
    const num = Number.parseFloat((m[1] ?? '0').replace(',', '.'));
    const unidad = (m[2] ?? '').toLowerCase();
    const gb = unidad === 'tb' ? num * 1024 : unidad === 'mb' ? num / 1024 : num;
    if (!mejor || gb > mejor.gb) mejor = { gb, raw: m[0] ?? '' };
  }
  return mejor;
}

/**
 * Números de modelo tipo "WH-1000XM5", "A2650", "SM-S918B".
 * Son la señal más fuerte después del GTIN.
 */
const RE_MODELO = /\b([a-z]{1,4}[-\s]?[a-z]?\d{2,5}[a-z]{0,3}\d{0,2})\b/gi;

/**
 * Prefijos que son unidades de medida, no marcas ni líneas de producto.
 * Sin esto, "128 GB" produce el falso código de modelo "gb128".
 */
const PREFIJOS_UNIDAD = /^(gb|tb|mb|kb|kg|g|mg|ml|l|cm|mm|m|w|kw|v|hz|khz|mhz|ghz|mah|wh|px|mp|pulg|in|ft|oz|lb)\d+$/;

export function extractModelCodes(s: string): readonly string[] {
  const texto = normalizeText(s);
  const out = new Set<string>();
  for (const m of texto.matchAll(RE_MODELO)) {
    const code = (m[1] ?? '').replace(/[-\s]/g, '');
    // Descarta cosas que son capacidades o años sueltos.
    if (/^\d+$/.test(code)) continue;
    if (PREFIJOS_UNIDAD.test(code)) continue;
    if (code.length >= 4) out.add(code);
  }
  return [...out];
}

/**
 * Generación o número de línea: el "15" de iPhone 15, el "XM5" de WH-1000XM5,
 * el "M3" de MacBook Air M3. Es lo que distingue modelos de distinto año.
 */
export function extractGeneracion(s: string): readonly string[] {
  const texto = normalizeText(s);
  const out = new Set<string>();

  // "iphone 15", "galaxy s24", "pixel 8"
  for (const m of texto.matchAll(/\b(?:iphone|galaxy|pixel|xperia|moto)\s*([a-z]?\d{1,2}[a-z]*)\b/g)) {
    if (m[1]) out.add(m[1]);
  }
  // "xm5", "xm4"
  for (const m of texto.matchAll(/xm(\d)\b/g)) {
    if (m[1]) out.add(`xm${m[1]}`);
  }
  // Chips Apple: m1/m2/m3/m4
  for (const m of texto.matchAll(/\b(m[1-9])\b/g)) {
    if (m[1]) out.add(m[1]);
  }
  // "11th generation", "11va generacion", "gen 11"
  for (const m of texto.matchAll(/\b(\d{1,2})\s*(?:th|st|nd|rd|va|ta|ma|era|mo)?\s*gen(?:eration|eracion)?\b/g)) {
    if (m[1]) out.add(`gen${m[1]}`);
  }
  for (const m of texto.matchAll(/\bgen(?:eration|eracion)?\s*(\d{1,2})\b(?!\s*(?:gb|tb|mb)\b)/g)) {
    if (m[1]) out.add(`gen${m[1]}`);
  }
  return [...out];
}

/** Variante de línea: pro, max, plus, ultra, mini, air, lite, se. */
const VARIANTES = ['pro max', 'pro', 'max', 'plus', 'ultra', 'mini', 'air', 'lite', 'se', 'fe'];

export function extractVariante(s: string): string | undefined {
  const texto = ` ${normalizeText(s)} `;
  for (const v of VARIANTES) {
    if (texto.includes(` ${v} `)) return v;
  }
  return undefined;
}

/** GTIN/EAN/UPC normalizado: sólo dígitos, y sólo si tiene largo válido. */
export function normalizeGtin(g: string | undefined): string | undefined {
  if (!g) return undefined;
  const digits = g.replace(/\D/g, '');
  // UPC-A 12, EAN-13 13, EAN-8 8, GTIN-14 14.
  if ([8, 12, 13, 14].includes(digits.length)) {
    // Un UPC-A de 12 es un EAN-13 con un 0 adelante: normalizamos a 13.
    return digits.length === 12 ? `0${digits}` : digits;
  }
  return undefined;
}

/** Similitud de tokens (Jaccard) entre dos títulos ya normalizados. */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(' ').filter((t) => t.length > 2));
  const tb = new Set(normalizeText(b).split(' ').filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}
