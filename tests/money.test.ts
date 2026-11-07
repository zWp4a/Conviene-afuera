import { describe, expect, it } from 'vitest';
import { add, format, fromUnits, mul, savingsPct, sub, toUnits, usd, uyu } from '@/lib/money';

describe('money', () => {
  it('no arrastra error de punto flotante', () => {
    // El caso clásico: 0.1 + 0.2 !== 0.3 en float.
    expect(add(usd(0.1), usd(0.2))).toEqual(usd(0.3));
    expect(toUnits(add(usd(0.1), usd(0.2)))).toBe(0.3);
  });

  it('suma una cadena larga sin desviarse', () => {
    const muchos = Array.from({ length: 100 }, () => usd(0.07));
    expect(toUnits(add(...muchos))).toBe(7);
  });

  it('redondea al centésimo al multiplicar', () => {
    // 19.99 * 0.22 = 4.3978 ⇒ 4.40
    expect(toUnits(mul(usd(19.99), 0.22))).toBe(4.4);
  });

  it('rechaza operar monedas distintas', () => {
    expect(() => add(usd(10), uyu(10))).toThrowError(/monedas distintas/);
    expect(() => sub(usd(10), uyu(10))).toThrowError(/monedas distintas/);
  });

  it('rechaza montos no finitos', () => {
    expect(() => fromUnits(Number.NaN, 'USD')).toThrowError(/no finito/);
    expect(() => fromUnits(Number.POSITIVE_INFINITY, 'UYU')).toThrowError(/no finito/);
  });

  it('calcula el porcentaje de ahorro con un decimal', () => {
    expect(savingsPct(uyu(1000), uyu(750))).toBe(25);
    expect(savingsPct(uyu(1000), uyu(1200))).toBe(-20);
    expect(savingsPct(uyu(0), uyu(100))).toBe(0);
  });

  it('formatea en es-UY', () => {
    expect(format(uyu(42990))).toContain('42');
    expect(format(usd(649))).toContain('649');
  });
});
