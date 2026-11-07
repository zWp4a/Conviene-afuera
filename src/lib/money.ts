/**
 * DINERO EN ENTEROS
 * ==================
 * Toda la plata de la app vive como centésimos enteros. Nunca `number` en
 * unidades: un `0.1 + 0.2` en un cálculo de impuestos es un bug de
 * credibilidad, no un detalle estético.
 */

export type Currency = 'UYU' | 'USD';

export interface Money {
  /** Centésimos. 1234 === $ 12,34 */
  readonly cents: number;
  readonly currency: Currency;
}

export function money(cents: number, currency: Currency): Money {
  if (!Number.isFinite(cents)) throw new Error(`Monto no finito: ${cents}`);
  return { cents: Math.round(cents), currency };
}

/** Construye un Money desde unidades (ej: 12.34 USD). */
export function fromUnits(units: number, currency: Currency): Money {
  if (!Number.isFinite(units)) throw new Error(`Monto no finito: ${units}`);
  return { cents: Math.round(units * 100), currency };
}

export const usd = (units: number): Money => fromUnits(units, 'USD');
export const uyu = (units: number): Money => fromUnits(units, 'UYU');
export const zero = (currency: Currency): Money => ({ cents: 0, currency });

export function toUnits(m: Money): number {
  return m.cents / 100;
}

function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`No se pueden operar monedas distintas: ${a.currency} y ${b.currency}`);
  }
}

export function add(...ms: Money[]): Money {
  const first = ms[0];
  if (!first) throw new Error('add() requiere al menos un monto');
  let acc = first.cents;
  for (const m of ms.slice(1)) {
    assertSame(first, m);
    acc += m.cents;
  }
  return { cents: acc, currency: first.currency };
}

export function sub(a: Money, b: Money): Money {
  assertSame(a, b);
  return { cents: a.cents - b.cents, currency: a.currency };
}

/** Multiplica por un factor y redondea al centésimo (half-up). */
export function mul(m: Money, factor: number): Money {
  if (!Number.isFinite(factor)) throw new Error(`Factor no finito: ${factor}`);
  return { cents: Math.round(m.cents * factor), currency: m.currency };
}

export function max(a: Money, b: Money): Money {
  assertSame(a, b);
  return a.cents >= b.cents ? a : b;
}

export function min(a: Money, b: Money): Money {
  assertSame(a, b);
  return a.cents <= b.cents ? a : b;
}

export function isZero(m: Money): boolean {
  return m.cents === 0;
}

export function gt(a: Money, b: Money): boolean {
  assertSame(a, b);
  return a.cents > b.cents;
}

export function gte(a: Money, b: Money): boolean {
  assertSame(a, b);
  return a.cents >= b.cents;
}

/** Nunca negativo: útil para cupos remanentes. */
export function clampZero(m: Money): Money {
  return m.cents < 0 ? zero(m.currency) : m;
}

/**
 * Porcentaje de ahorro de `b` respecto de `a`, redondeado a 1 decimal.
 * Positivo = `b` es más barato.
 */
export function savingsPct(a: Money, b: Money): number {
  assertSame(a, b);
  if (a.cents === 0) return 0;
  return Math.round(((a.cents - b.cents) / a.cents) * 1000) / 10;
}

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  UYU: new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0,
  }),
  USD: new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }),
};

/** Formato para mostrar: "$ 12.345" en UYU, "US$ 123,45" en USD. */
export function format(m: Money): string {
  return FORMATTERS[m.currency].format(toUnits(m));
}
