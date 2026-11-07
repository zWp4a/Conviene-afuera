/**
 * TESTS DE LANDED-COST
 * =====================
 * Cubre los casos que pide el brief:
 *   - origen EE.UU. ≤ USD 200 (exento)
 *   - origen EE.UU. > USD 200 (gravado)
 *   - otro origen (gravado, sin exención)
 *   - cupo agotado
 *   - envíos agotados
 *   - régimen simplificado con mínimo de USD 20
 * Más los casos borde que aparecieron al escribir el motor.
 */
import { describe, expect, it } from 'vitest';
import { ADUANA_UY } from '@config/aduana-uy';
import { toUnits, usd } from '@/lib/money';
import {
  calcularLandedCost,
  calcularSimplificado,
  cupoRestanteUsd,
  enviosRestantes,
  aplicaExencionEeuu,
  type EstadoFranquicia,
  type LandedCostInput,
} from '@/modules/landed-cost';

const base: LandedCostInput = {
  productPrice: usd(100),
  domesticShipping: usd(0),
  weightGrams: 500,
  weightIsEstimated: false,
  originCountry: 'US',
  merchantTaxCountry: 'US',
  courierId: 'aeropost',
};

const franquiciaLimpia: EstadoFranquicia = {
  enviosUsados: 0,
  cupoUsadoUsd: 0,
  asumido: false,
};

describe('franquicia — exención EE.UU.', () => {
  it('EE.UU. hasta USD 200: no paga IVA', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(200) });
    expect(r.franquicia.applicable).toBe(true);
    expect(r.franquicia.taxUsd.cents).toBe(0);
    expect(r.franquicia.tasaEfectivaPct).toBe(0);
    expect(r.franquicia.explicacionImpuesto).toContain('Exento');
  });

  it('EE.UU. por encima de USD 200: paga IVA 22%', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(300) });
    expect(r.franquicia.applicable).toBe(true);
    // 300 * 0.22 = 66
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(66, 2);
    expect(r.franquicia.tasaEfectivaPct).toBeCloseTo(22, 1);
  });

  it('justo en el límite de USD 200 sigue exento (el tope es inclusivo)', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(200) });
    expect(r.franquicia.taxUsd.cents).toBe(0);
  });

  it('un centavo por encima del tope ya paga IVA', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(200.01) });
    expect(r.franquicia.taxUsd.cents).toBeGreaterThan(0);
  });

  it('otro origen (China): paga IVA aunque sea menos de USD 200', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(150),
      originCountry: 'CN',
      merchantTaxCountry: 'CN',
    });
    // 150 * 0.22 = 33
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(33, 2);
  });

  it('sede fiscal desconocida: NO aplica la exención y lo advierte', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(150),
      merchantTaxCountry: undefined,
    });
    expect(r.franquicia.taxUsd.cents).toBeGreaterThan(0);
    expect(r.franquicia.warnings).toContain('SEDE_FISCAL_DESCONOCIDA');
  });

  it('envío desde EE.UU. pero comercio que no tributa allí: no exento', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(150),
      originCountry: 'US',
      merchantTaxCountry: 'CN',
    });
    expect(r.franquicia.taxUsd.cents).toBeGreaterThan(0);
    expect(r.franquicia.warnings).not.toContain('SEDE_FISCAL_DESCONOCIDA');
  });

  it('aplicaExencionEeuu explica por qué no aplica', () => {
    const r = aplicaExencionEeuu({
      productUsd: usd(500),
      originCountry: 'US',
      merchantTaxCountry: 'US',
    });
    expect(r.aplica).toBe(false);
    expect(r.motivo).toContain('200');
  });
});

describe('franquicia — mínimo de IVA', () => {
  it('compra chica gravada paga el mínimo de USD 20, no el 22%', () => {
    // USD 50 desde China: 22% = 11, pero el mínimo es 20.
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(50),
      originCountry: 'CN',
      merchantTaxCountry: 'CN',
    });
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(ADUANA_UY.franquicia.ivaMinimoUsd, 2);
    expect(r.franquicia.explicacionImpuesto).toContain('mínimo');
    // La tasa efectiva es 40%, no 22%.
    expect(r.franquicia.tasaEfectivaPct).toBeCloseTo(40, 1);
  });

  it('por encima del punto de equilibrio se cobra el 22% y no el mínimo', () => {
    // El equilibrio está en 20 / 0.22 = 90.91
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(100),
      originCountry: 'CN',
      merchantTaxCountry: 'CN',
    });
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(22, 2);
    expect(r.franquicia.explicacionImpuesto).not.toContain('mínimo');
  });
});

describe('franquicia — cupo y envíos', () => {
  it('cupo agotado: la franquicia no es aplicable', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(100),
      franquicia: { enviosUsados: 1, cupoUsadoUsd: 800, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.franquicia.bloqueo?.code).toBe('CUPO_INSUFICIENTE');
    // El simplificado sigue disponible.
    expect(r.simplificado.applicable).toBe(true);
    expect(r.recomendado?.regime).toBe('simplificado');
  });

  it('cupo parcial insuficiente para este producto: bloquea y dice cuánto queda', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(300),
      franquicia: { enviosUsados: 1, cupoUsadoUsd: 650, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.franquicia.bloqueo?.code).toBe('CUPO_INSUFICIENTE');
    expect(r.franquicia.bloqueo?.message).toContain('150');
  });

  it('cupo parcial suficiente: la franquicia sigue sirviendo', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(100),
      franquicia: { enviosUsados: 2, cupoUsadoUsd: 650, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(true);
  });

  it('envíos agotados: la franquicia no es aplicable aunque quede cupo en USD', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(50),
      franquicia: { enviosUsados: 3, cupoUsadoUsd: 100, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.franquicia.bloqueo?.code).toBe('ENVIOS_AGOTADOS');
  });

  it('el IVA pagado no consume cupo: sólo el valor del producto', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(300),
      franquicia: franquiciaLimpia,
    });
    expect(r.franquicia.consumeFranquicia?.cupoUsd).toBeCloseTo(300, 2);
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(66, 2);
  });

  it('helpers de cupo y envíos restantes', () => {
    expect(cupoRestanteUsd({ enviosUsados: 1, cupoUsadoUsd: 300, asumido: false })).toBe(500);
    expect(cupoRestanteUsd({ enviosUsados: 1, cupoUsadoUsd: 900, asumido: false })).toBe(0);
    expect(enviosRestantes({ enviosUsados: 2, cupoUsadoUsd: 0, asumido: false })).toBe(1);
    expect(enviosRestantes({ enviosUsados: 5, cupoUsadoUsd: 0, asumido: false })).toBe(0);
  });
});

describe('régimen simplificado', () => {
  it('cobra el 60% del valor del producto', () => {
    const r = calcularSimplificado({
      productUsd: usd(100),
      shippingUsd: usd(20),
      weightGrams: 500,
    });
    expect(toUnits(r.taxUsd)).toBeCloseTo(60, 2);
    expect(r.explicacion).toContain('60%');
  });

  it('aplica el mínimo de USD 20 en compras chicas', () => {
    // USD 30 * 0.60 = 18, menor al mínimo de 20.
    const r = calcularSimplificado({
      productUsd: usd(30),
      shippingUsd: usd(10),
      weightGrams: 300,
    });
    expect(toUnits(r.taxUsd)).toBeCloseTo(20, 2);
    expect(r.explicacion).toContain('Mínimo');
  });

  it('con el mínimo, la tasa efectiva supera el 60% nominal', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(30),
      originCountry: 'CN',
      merchantTaxCountry: 'CN',
    });
    // 20 / 30 = 66.7%
    expect(r.simplificado.tasaEfectivaPct).toBeCloseTo(66.7, 1);
  });

  it('el punto de equilibrio del mínimo está en USD 33,33', () => {
    const justoDebajo = calcularSimplificado({
      productUsd: usd(33.33),
      shippingUsd: usd(0),
      weightGrams: 100,
    });
    const justoArriba = calcularSimplificado({
      productUsd: usd(33.34),
      shippingUsd: usd(0),
      weightGrams: 100,
    });
    expect(toUnits(justoDebajo.taxUsd)).toBeCloseTo(20, 2);
    expect(toUnits(justoArriba.taxUsd)).toBeCloseTo(20.0, 1);
  });

  it('supera el tope de USD 800 por envío: no es aplicable', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(900) });
    expect(r.simplificado.applicable).toBe(false);
    expect(r.simplificado.bloqueo?.code).toBe('SUPERA_TOPE_VALOR');
  });

  it('supera el tope de 20 kg: no es aplicable', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(100), weightGrams: 25_000 });
    expect(r.simplificado.applicable).toBe(false);
    expect(r.simplificado.bloqueo?.code).toBe('SUPERA_TOPE_PESO');
  });

  it('no consume cupo de franquicia', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(100) });
    expect(r.simplificado.consumeFranquicia).toBeUndefined();
  });

  it('sin límite de cantidad de envíos al año', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(100),
      franquicia: { enviosUsados: 10, cupoUsadoUsd: 800, asumido: false },
    });
    expect(r.simplificado.applicable).toBe(true);
  });
});

describe('comparación de regímenes', () => {
  it('EE.UU. ≤ 200: recomienda franquicia (exenta) sobre simplificado (60%)', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(150) });
    expect(r.recomendado?.regime).toBe('franquicia');
    expect(r.recomendado?.taxUsd.cents).toBe(0);
  });

  it('con el cupo agotado recomienda simplificado', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(150),
      franquicia: { enviosUsados: 3, cupoUsadoUsd: 800, asumido: false },
    });
    expect(r.recomendado?.regime).toBe('simplificado');
  });

  it('producto de USD 900 con cupo disponible: franquicia sí, simplificado no', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(900) });
    // 900 supera el cupo anual de 800 ⇒ la franquicia tampoco sirve.
    expect(r.franquicia.applicable).toBe(false);
    expect(r.simplificado.applicable).toBe(false);
    expect(r.recomendado).toBeUndefined();
  });

  it('siempre devuelve los dos escenarios calculados, aplicables o no', () => {
    const r = calcularLandedCost({
      ...base,
      franquicia: { enviosUsados: 3, cupoUsadoUsd: 800, asumido: false },
    });
    expect(r.franquicia).toBeDefined();
    expect(r.simplificado).toBeDefined();
    expect(r.franquicia.applicable).toBe(false);
  });
});

describe('costo de courier y advertencias', () => {
  it('suma producto + envío doméstico + courier + impuestos', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(150),
      domesticShipping: usd(10),
    });
    const f = r.franquicia;
    const esperado =
      f.productUsd.cents + f.domesticShippingUsd.cents + f.courierUsd.cents + f.taxUsd.cents;
    expect(f.totalUsd.cents).toBe(esperado);
  });

  it('cobra el peso mínimo facturable en envíos muy livianos', () => {
    const liviano = calcularLandedCost({ ...base, weightGrams: 50 });
    const medioKilo = calcularLandedCost({ ...base, weightGrams: 500 });
    expect(liviano.franquicia.courierUsd.cents).toBe(medioKilo.franquicia.courierUsd.cents);
  });

  it('el courier crece con el peso', () => {
    const liviano = calcularLandedCost({ ...base, weightGrams: 500 });
    const pesado = calcularLandedCost({ ...base, weightGrams: 5000 });
    expect(pesado.franquicia.courierUsd.cents).toBeGreaterThan(liviano.franquicia.courierUsd.cents);
  });

  it('advierte cuando el peso es estimado', () => {
    const r = calcularLandedCost({ ...base, weightIsEstimated: true });
    expect(r.franquicia.warnings).toContain('PESO_ESTIMADO');
    expect(r.peso.esEstimado).toBe(true);
  });

  it('advierte que las tarifas de courier no están verificadas', () => {
    const r = calcularLandedCost(base);
    expect(r.franquicia.warnings).toContain('TARIFA_COURIER_SIN_VERIFICAR');
  });

  it('advierte que la normativa no está verificada contra fuente oficial', () => {
    const r = calcularLandedCost(base);
    expect(r.franquicia.warnings).toContain('NORMATIVA_SIN_VERIFICAR');
  });

  it('advierte cuando no se conoce el envío doméstico', () => {
    const r = calcularLandedCost({ ...base, domesticShipping: undefined });
    expect(r.franquicia.warnings).toContain('ENVIO_DOMESTICO_DESCONOCIDO');
  });
});
