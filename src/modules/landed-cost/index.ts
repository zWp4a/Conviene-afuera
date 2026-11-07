/**
 * LANDED-COST
 * ============
 * Costo real puesto en Uruguay: producto + envío doméstico + courier +
 * impuestos, para los DOS regímenes.
 *
 * Devuelve siempre los dos escenarios con un flag `applicable`, porque no
 * siempre son comparables: con un producto de USD 100 desde EE.UU. la
 * franquicia paga USD 0 y el simplificado USD 60; con el cupo agotado la
 * franquicia no existe. Decidir qué mostrar es tarea del `advisor`, no de acá.
 */
import { ADUANA_UY } from '@config/aduana-uy';
import { add, toUnits, zero, type Money } from '@/lib/money';
import { costoCourier } from './courier';
import { calcularFranquicia } from './franquicia';
import { calcularSimplificado } from './simplificado';
import {
  FRANQUICIA_DISPONIBLE,
  type LandedCostBreakdown,
  type LandedCostInput,
  type LandedCostResult,
  type WarningCode,
} from './types';

export * from './types';
export { cupoRestanteUsd, enviosRestantes, aplicaExencionEeuu } from './franquicia';
export { costoCourier } from './courier';
export { calcularFranquicia } from './franquicia';
export { calcularSimplificado } from './simplificado';

function tasaEfectiva(taxUsd: Money, productUsd: Money): number {
  if (productUsd.cents === 0) return 0;
  return Math.round((taxUsd.cents / productUsd.cents) * 1000) / 10;
}

export function calcularLandedCost(input: LandedCostInput): LandedCostResult {
  const estado = input.franquicia ?? FRANQUICIA_DISPONIBLE;
  const productUsd = input.productPrice;
  const domesticShippingUsd = input.domesticShipping ?? zero('USD');
  const courier = costoCourier(input.courierId, input.weightGrams);

  // Advertencias comunes a los dos regímenes.
  const comunes: WarningCode[] = [];
  if (input.weightIsEstimated) comunes.push('PESO_ESTIMADO');
  if (!courier.tarifaVerificada) comunes.push('TARIFA_COURIER_SIN_VERIFICAR');
  if (!ADUANA_UY.verificadoContraFuenteOficial) comunes.push('NORMATIVA_SIN_VERIFICAR');
  if (input.domesticShipping === undefined) comunes.push('ENVIO_DOMESTICO_DESCONOCIDO');

  const envioTotal = add(domesticShippingUsd, courier.total);

  // --- Franquicia ---
  const f = calcularFranquicia({
    productUsd,
    shippingUsd: envioTotal,
    originCountry: input.originCountry,
    ...(input.merchantTaxCountry ? { merchantTaxCountry: input.merchantTaxCountry } : {}),
    estado,
  });

  const franquicia: LandedCostBreakdown = {
    regime: 'franquicia',
    applicable: f.bloqueo === undefined,
    ...(f.bloqueo ? { bloqueo: f.bloqueo } : {}),
    productUsd,
    domesticShippingUsd,
    courierUsd: courier.total,
    taxUsd: f.taxUsd,
    totalUsd: add(productUsd, domesticShippingUsd, courier.total, f.taxUsd),
    tasaEfectivaPct: tasaEfectiva(f.taxUsd, productUsd),
    explicacionImpuesto: f.explicacion,
    consumeFranquicia: f.consume,
    warnings: [...comunes, ...f.warnings],
    courierNombre: courier.courier.nombre,
    diasEstimados: courier.courier.diasEstimados,
  };

  // --- Simplificado ---
  const s = calcularSimplificado({
    productUsd,
    shippingUsd: envioTotal,
    weightGrams: input.weightGrams,
  });

  const simplificado: LandedCostBreakdown = {
    regime: 'simplificado',
    applicable: s.bloqueo === undefined,
    ...(s.bloqueo ? { bloqueo: s.bloqueo } : {}),
    productUsd,
    domesticShippingUsd,
    courierUsd: courier.total,
    taxUsd: s.taxUsd,
    totalUsd: add(productUsd, domesticShippingUsd, courier.total, s.taxUsd),
    tasaEfectivaPct: tasaEfectiva(s.taxUsd, productUsd),
    explicacionImpuesto: s.explicacion,
    warnings: [...comunes, ...s.warnings],
    courierNombre: courier.courier.nombre,
    diasEstimados: courier.courier.diasEstimados,
  };

  // --- El más barato entre los aplicables ---
  const aplicables = [franquicia, simplificado].filter((b) => b.applicable);
  const recomendado = aplicables.sort((a, b) => a.totalUsd.cents - b.totalUsd.cents)[0];

  return {
    franquicia,
    simplificado,
    ...(recomendado ? { recomendado } : {}),
    peso: { gramos: input.weightGrams, esEstimado: input.weightIsEstimated },
  };
}

/** Texto para mostrar cada código de advertencia. */
export const TEXTO_WARNING: Record<WarningCode, string> = {
  PESO_ESTIMADO:
    'El peso es una estimación por categoría: el producto no informa su peso real, así que el costo de courier puede variar.',
  TARIFA_COURIER_SIN_VERIFICAR:
    'Las tarifas de courier de esta versión son valores de referencia sin verificar. Confirmá el precio con el courier.',
  NORMATIVA_SIN_VERIFICAR:
    'Los parámetros aduaneros de esta versión provienen de guías de couriers y prensa, no del texto oficial del decreto. Verificá en aduanas.gub.uy antes de decidir una compra.',
  SEDE_FISCAL_DESCONOCIDA:
    'No pudimos confirmar si el comercio tiene sede fiscal en EE.UU., así que calculamos CON IVA. Si la tienda tributa en EE.UU. y la compra es de hasta USD 200, podría salir exenta y el total sería menor.',
  COTIZACION_FALLBACK:
    'La cotización del dólar es un valor de respaldo, no la del día del BCU.',
  ENVIO_DOMESTICO_DESCONOCIDO:
    'La tienda no informa el costo de envío hasta el warehouse: lo calculamos como 0 y puede sumar.',
};

/** Suma neta de lo que consume de la franquicia, si se usa ese régimen. */
export function cupoQueConsume(result: LandedCostResult): number {
  return result.franquicia.applicable ? toUnits(result.franquicia.productUsd) : 0;
}
