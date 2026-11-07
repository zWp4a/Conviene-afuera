/**
 * TESTS DE LANDED-COST
 * =====================
 * Los parámetros están verificados contra el Decreto N° 50/026, los artículos
 * 627-635 de la Ley 20.446 y las páginas de la DNA. Estos tests fijan ese
 * comportamiento: si alguien cambia un número en config/aduana-uy.ts sin
 * fuente, acá se entera.
 *
 * Cubre los casos que pide el brief (origen EE.UU. ≤ 200, > 200, otro origen,
 * cupo agotado, envíos agotados, mínimo de USD 20 del simplificado) más los
 * bordes que aparecieron al cotejar la normativa.
 */
import { describe, expect, it } from 'vitest';
import { ADUANA_UY } from '@config/aduana-uy';
import { vendedorRegistradoEnDna } from '@config/vendedores-eeuu';
import { toUnits, usd } from '@/lib/money';
import {
  aplicaExoneracionAcuerdo,
  calcularLandedCost,
  calcularSimplificado,
  cupoRestanteUsd,
  enviosRestantes,
  type EstadoFranquicia,
  type LandedCostInput,
} from '@/modules/landed-cost';

/** Vendedor que SÍ figura en el registro de Aduanas. */
const base: LandedCostInput = {
  productPrice: usd(100),
  domesticShipping: usd(0),
  weightGrams: 500,
  weightIsEstimated: false,
  originCountry: 'US',
  merchantTaxCountry: 'US',
  merchantName: 'AMAZON.COM, INC.',
  courierId: 'aeropost',
};

/** Vendedor que NO figura en el registro, pero declara residencia en EE.UU. */
const sinRegistro: LandedCostInput = {
  ...base,
  merchantName: 'TIENDITA RANDOM LLC',
};

const ANTES_DE_2027 = new Date('2026-11-07');
const DESPUES_DE_2027 = new Date('2027-03-01');

describe('exoneración de IVA por acuerdo comercial (EE.UU.)', () => {
  it('vendedor registrado en Aduanas y envío ≤ USD 200: exento', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(200) });
    expect(r.franquicia.applicable).toBe(true);
    expect(r.franquicia.taxUsd.cents).toBe(0);
    expect(r.franquicia.explicacionImpuesto).toContain('Exento');
  });

  it('por encima de USD 200 paga IVA 22%, aunque el vendedor esté registrado', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(300) });
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(66, 2);
    expect(r.franquicia.tasaEfectivaPct).toBeCloseTo(22, 1);
  });

  it('el tope de USD 200 es inclusivo', () => {
    expect(calcularLandedCost({ ...base, productPrice: usd(200) }).franquicia.taxUsd.cents).toBe(0);
    expect(
      calcularLandedCost({ ...base, productPrice: usd(200.01) }).franquicia.taxUsd.cents,
    ).toBeGreaterThan(0);
  });

  it('el envío que cobra la tienda cuenta para el tope de USD 200', () => {
    // USD 190 de producto + USD 15 de envío = USD 205 de factura ⇒ se pasa.
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(190),
      domesticShipping: usd(15),
    });
    expect(r.franquicia.taxUsd.cents).toBeGreaterThan(0);
    expect(toUnits(r.franquicia.valorFacturaUsd)).toBeCloseTo(205, 2);
  });

  it('el envío exonerado consume cupo igual', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(150) });
    expect(r.franquicia.taxUsd.cents).toBe(0);
    expect(r.franquicia.consumeFranquicia?.cupoUsd).toBeCloseTo(150, 2);
    expect(r.franquicia.consumeFranquicia?.envios).toBe(1);
  });

  it('otro origen (China): paga IVA aunque sea menos de USD 200', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(150),
      originCountry: 'CN',
      merchantTaxCountry: 'CN',
      merchantName: 'SHENZHEN WIDGETS CO',
    });
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(33, 2);
  });

  it('residencia fiscal desconocida: NO exonera y lo advierte', () => {
    const r = calcularLandedCost({
      ...sinRegistro,
      productPrice: usd(150),
      merchantTaxCountry: undefined,
    });
    expect(r.franquicia.taxUsd.cents).toBeGreaterThan(0);
    expect(r.franquicia.warnings).toContain('RESIDENCIA_FISCAL_DESCONOCIDA');
  });

  it('sale de EE.UU. pero el vendedor no tributa allí: no exonera', () => {
    const r = calcularLandedCost({
      ...sinRegistro,
      productPrice: usd(150),
      originCountry: 'US',
      merchantTaxCountry: 'CN',
    });
    expect(r.franquicia.taxUsd.cents).toBeGreaterThan(0);
    expect(r.franquicia.warnings).not.toContain('RESIDENCIA_FISCAL_DESCONOCIDA');
  });

  it('antes del 1/2/2027 alcanza con acreditar residencia fiscal por factura', () => {
    const r = aplicaExoneracionAcuerdo({
      valorFacturaUsd: usd(150),
      originCountry: 'US',
      merchantTaxCountry: 'US',
      merchantName: 'TIENDITA RANDOM LLC',
      hoy: ANTES_DE_2027,
    });
    expect(r.aplica).toBe(true);
  });

  it('desde el 1/2/2027 el vendedor tiene que estar registrado ante Aduanas', () => {
    const r = aplicaExoneracionAcuerdo({
      valorFacturaUsd: usd(150),
      originCountry: 'US',
      merchantTaxCountry: 'US',
      merchantName: 'TIENDITA RANDOM LLC',
      hoy: DESPUES_DE_2027,
    });
    expect(r.aplica).toBe(false);
    expect(r.warnings).toContain('VENDEDOR_NO_REGISTRADO');
  });

  it('un vendedor registrado sigue exonerando después del 1/2/2027', () => {
    const r = aplicaExoneracionAcuerdo({
      valorFacturaUsd: usd(150),
      originCountry: 'US',
      merchantName: 'AMAZON.COM, INC.',
      hoy: DESPUES_DE_2027,
    });
    expect(r.aplica).toBe(true);
  });

  it('el registro de Aduanas tolera variaciones de la razón social', () => {
    expect(vendedorRegistradoEnDna('AMAZON.COM, INC.')).toBe(true);
    expect(vendedorRegistradoEnDna('amazon.com inc')).toBe(true);
    expect(vendedorRegistradoEnDna('Apple Inc.')).toBe(true);
    expect(vendedorRegistradoEnDna('eBay Inc')).toBe(true);
    expect(vendedorRegistradoEnDna('Tiendita Random')).toBe(false);
    expect(vendedorRegistradoEnDna(undefined)).toBe(false);
  });

  it('no hace coincidencias parciales: un falso positivo prometería una exoneración inexistente', () => {
    expect(vendedorRegistradoEnDna('FAKE AMAZON STORE')).toBe(false);
    expect(vendedorRegistradoEnDna('APPLE REPAIRS MONTEVIDEO')).toBe(false);
  });
});

describe('franquicia — NO tiene pago mínimo', () => {
  it('una compra chica gravada paga el 22%, no un mínimo de USD 20', () => {
    // Este es el error que traía la versión anterior: las guías de couriers
    // hablan de un mínimo de USD 20 que en el decreto pertenece sólo al
    // régimen simplificado.
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(50),
      originCountry: 'CN',
      merchantTaxCountry: 'CN',
      merchantName: 'SHENZHEN WIDGETS CO',
    });
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(11, 2);
    expect(r.franquicia.tasaEfectivaPct).toBeCloseTo(22, 1);
    expect(r.franquicia.explicacionImpuesto).not.toContain('mínimo');
  });

  it('la normativa declara explícitamente que no hay mínimo', () => {
    expect(ADUANA_UY.franquicia.pagoMinimoUsd).toBeNull();
  });
});

describe('franquicia — cupo y envíos', () => {
  it('cupo agotado: no es aplicable y el simplificado toma el relevo', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(100),
      franquicia: { enviosUsados: 1, cupoUsadoUsd: 800, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.franquicia.bloqueo?.code).toBe('CUPO_INSUFICIENTE');
    expect(r.simplificado.applicable).toBe(true);
    expect(r.recomendado?.regime).toBe('simplificado');
  });

  it('cupo parcial insuficiente: dice cuánto queda', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(300),
      franquicia: { enviosUsados: 1, cupoUsadoUsd: 650, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.franquicia.bloqueo?.message).toContain('150');
  });

  it('cupo parcial suficiente: sigue sirviendo', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(100),
      franquicia: { enviosUsados: 2, cupoUsadoUsd: 650, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(true);
  });

  it('envíos agotados: no es aplicable aunque quede cupo en USD', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(50),
      franquicia: { enviosUsados: 3, cupoUsadoUsd: 100, asumido: false },
    });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.franquicia.bloqueo?.code).toBe('ENVIOS_AGOTADOS');
  });

  it('el IVA pagado no consume cupo: sólo el valor de factura', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(300) });
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

describe('régimen simplificado (prestación única)', () => {
  it('cobra el 60% del valor de factura', () => {
    const r = calcularSimplificado({ valorFacturaUsd: usd(100), weightGrams: 500 });
    expect(toUnits(r.taxUsd)).toBeCloseTo(60, 2);
    expect(r.explicacion).toContain('60%');
  });

  it('aplica el pago mínimo de USD 20 en envíos chicos', () => {
    // USD 30 * 0,60 = 18, menor al mínimo de 20.
    const r = calcularSimplificado({ valorFacturaUsd: usd(30), weightGrams: 300 });
    expect(toUnits(r.taxUsd)).toBeCloseTo(20, 2);
    expect(r.explicacion).toContain('mínimo');
  });

  it('con el mínimo, la tasa efectiva supera el 60% nominal', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(30),
      originCountry: 'CN',
      merchantTaxCountry: 'CN',
      merchantName: 'SHENZHEN WIDGETS CO',
    });
    expect(r.simplificado.tasaEfectivaPct).toBeCloseTo(66.7, 1);
  });

  it('el punto de equilibrio del mínimo está en USD 33,33', () => {
    expect(
      toUnits(calcularSimplificado({ valorFacturaUsd: usd(33.33), weightGrams: 100 }).taxUsd),
    ).toBeCloseTo(20, 2);
    expect(
      toUnits(calcularSimplificado({ valorFacturaUsd: usd(40), weightGrams: 100 }).taxUsd),
    ).toBeCloseTo(24, 2);
  });

  it('supera el tope de USD 800 por envío: no es aplicable', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(900) });
    expect(r.simplificado.applicable).toBe(false);
    expect(r.simplificado.bloqueo?.code).toBe('SUPERA_TOPE_VALOR');
  });

  it('no consume cupo de franquicia', () => {
    expect(calcularLandedCost({ ...base }).simplificado.consumeFranquicia).toBeUndefined();
  });

  it('sin límite de cantidad de envíos al año', () => {
    const r = calcularLandedCost({
      ...base,
      franquicia: { enviosUsados: 10, cupoUsadoUsd: 800, asumido: false },
    });
    expect(r.simplificado.applicable).toBe(true);
  });
});

describe('tope de 20 kg — aplica a TODO el régimen, no sólo al simplificado', () => {
  it('bloquea la franquicia', () => {
    const r = calcularLandedCost({ ...base, weightGrams: 25_000 });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.franquicia.bloqueo?.code).toBe('SUPERA_TOPE_PESO');
  });

  it('bloquea el simplificado', () => {
    const r = calcularLandedCost({ ...base, weightGrams: 25_000 });
    expect(r.simplificado.applicable).toBe(false);
    expect(r.simplificado.bloqueo?.code).toBe('SUPERA_TOPE_PESO');
  });

  it('con más de 20 kg no queda ningún régimen', () => {
    expect(calcularLandedCost({ ...base, weightGrams: 25_000 }).recomendado).toBeUndefined();
  });

  it('justo en 20 kg todavía entra', () => {
    const r = calcularLandedCost({ ...base, weightGrams: 20_000 });
    expect(r.franquicia.applicable).toBe(true);
    expect(r.simplificado.applicable).toBe(true);
  });
});

describe('comparación de regímenes', () => {
  it('vendedor registrado y ≤ USD 200: franquicia (exenta) le gana al 60%', () => {
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

  it('un envío de USD 900 no entra en ningún régimen', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(900) });
    expect(r.franquicia.applicable).toBe(false);
    expect(r.simplificado.applicable).toBe(false);
    expect(r.recomendado).toBeUndefined();
  });

  it('siempre devuelve los dos escenarios, aplicables o no', () => {
    const r = calcularLandedCost({
      ...base,
      franquicia: { enviosUsados: 3, cupoUsadoUsd: 800, asumido: false },
    });
    expect(r.franquicia).toBeDefined();
    expect(r.simplificado).toBeDefined();
    expect(r.franquicia.applicable).toBe(false);
  });
});

describe('courier, base imponible y advertencias', () => {
  it('el total es factura + courier + impuestos', () => {
    const r = calcularLandedCost({ ...base, productPrice: usd(150), domesticShipping: usd(10) });
    const f = r.franquicia;
    expect(f.totalUsd.cents).toBe(f.valorFacturaUsd.cents + f.courierUsd.cents + f.taxUsd.cents);
    expect(f.valorFacturaUsd.cents).toBe(f.productUsd.cents + f.domesticShippingUsd.cents);
  });

  it('el courier uruguayo NO integra la base imponible', () => {
    // No está en la factura del exterior, así que no se le aplica el impuesto.
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(300),
      domesticShipping: usd(0),
    });
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(66, 2); // 300 * 0.22, sin courier
    expect(r.franquicia.courierUsd.cents).toBeGreaterThan(0);
  });

  it('el envío que cobra la tienda SÍ integra la base imponible', () => {
    const r = calcularLandedCost({
      ...base,
      productPrice: usd(300),
      domesticShipping: usd(20),
    });
    expect(toUnits(r.franquicia.taxUsd)).toBeCloseTo(70.4, 2); // 320 * 0.22
  });

  it('cobra el peso mínimo facturable en envíos muy livianos', () => {
    expect(calcularLandedCost({ ...base, weightGrams: 50 }).franquicia.courierUsd.cents).toBe(
      calcularLandedCost({ ...base, weightGrams: 500 }).franquicia.courierUsd.cents,
    );
  });

  it('el courier crece con el peso', () => {
    expect(
      calcularLandedCost({ ...base, weightGrams: 5000 }).franquicia.courierUsd.cents,
    ).toBeGreaterThan(calcularLandedCost({ ...base, weightGrams: 500 }).franquicia.courierUsd.cents);
  });

  it('advierte cuando el peso es estimado', () => {
    const r = calcularLandedCost({ ...base, weightIsEstimated: true });
    expect(r.franquicia.warnings).toContain('PESO_ESTIMADO');
    expect(r.peso.esEstimado).toBe(true);
  });

  it('advierte que las tarifas de courier no están verificadas', () => {
    expect(calcularLandedCost(base).franquicia.warnings).toContain('TARIFA_COURIER_SIN_VERIFICAR');
  });

  it('YA NO advierte sobre la normativa: está verificada contra fuente oficial', () => {
    expect(ADUANA_UY.verificadoContraFuenteOficial).toBe(true);
    expect(calcularLandedCost(base).franquicia.warnings).not.toContain('NORMATIVA_SIN_VERIFICAR');
  });

  it('advierte cuando no se conoce el envío de la tienda', () => {
    const r = calcularLandedCost({ ...base, domesticShipping: undefined });
    expect(r.franquicia.warnings).toContain('ENVIO_DOMESTICO_DESCONOCIDO');
  });
});
