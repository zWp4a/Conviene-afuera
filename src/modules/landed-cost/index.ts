/**
 * LANDED-COST
 * ============
 * Costo real puesto en Uruguay: producto + envío de la tienda + courier +
 * impuestos, para los DOS regímenes.
 *
 * Devuelve siempre los dos escenarios con un flag `applicable`, porque no
 * siempre son comparables: con un envío de USD 100 desde un vendedor
 * registrado en EE.UU. la franquicia paga USD 0 y el simplificado USD 60;
 * con el cupo agotado la franquicia no existe. Decidir qué mostrar es tarea
 * del `advisor`, no de acá.
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
export { cupoRestanteUsd, enviosRestantes, aplicaExoneracionAcuerdo } from './franquicia';
export { costoCourier } from './courier';
export { calcularFranquicia } from './franquicia';
export { calcularSimplificado } from './simplificado';

function tasaEfectiva(taxUsd: Money, baseUsd: Money): number {
  if (baseUsd.cents === 0) return 0;
  return Math.round((taxUsd.cents / baseUsd.cents) * 1000) / 10;
}

export function calcularLandedCost(input: LandedCostInput): LandedCostResult {
  const estado = input.franquicia ?? FRANQUICIA_DISPONIBLE;
  const productUsd = input.productPrice;
  const domesticShippingUsd = input.domesticShipping ?? zero('USD');
  const courier = costoCourier(input.courierId, input.weightGrams);

  // Base imponible = total de la factura del exterior (Decreto 50/026 art. 5):
  // producto + lo que la tienda cobra por el envío. Lo que cobra el courier
  // uruguayo NO está en esa factura, así que no integra la base.
  const valorFacturaUsd = add(productUsd, domesticShippingUsd);

  const comunes: WarningCode[] = [];
  if (input.weightIsEstimated) comunes.push('PESO_ESTIMADO');
  if (!courier.tarifaVerificada) comunes.push('TARIFA_COURIER_SIN_VERIFICAR');
  if (!ADUANA_UY.verificadoContraFuenteOficial) comunes.push('NORMATIVA_SIN_VERIFICAR');
  if (input.domesticShipping === undefined) comunes.push('ENVIO_DOMESTICO_DESCONOCIDO');

  // --- Franquicia ---
  const f = calcularFranquicia({
    valorFacturaUsd,
    originCountry: input.originCountry,
    ...(input.merchantTaxCountry ? { merchantTaxCountry: input.merchantTaxCountry } : {}),
    ...(input.merchantName ? { merchantName: input.merchantName } : {}),
    weightGrams: input.weightGrams,
    estado,
  });

  const franquicia: LandedCostBreakdown = {
    regime: 'franquicia',
    applicable: f.bloqueo === undefined,
    ...(f.bloqueo ? { bloqueo: f.bloqueo } : {}),
    productUsd,
    domesticShippingUsd,
    valorFacturaUsd,
    courierUsd: courier.total,
    taxUsd: f.taxUsd,
    totalUsd: add(valorFacturaUsd, courier.total, f.taxUsd),
    tasaEfectivaPct: tasaEfectiva(f.taxUsd, valorFacturaUsd),
    explicacionImpuesto: f.explicacion,
    consumeFranquicia: f.consume,
    warnings: [...comunes, ...f.warnings],
    courierNombre: courier.courier.nombre,
    diasEstimados: courier.courier.diasEstimados,
  };

  // --- Simplificado ---
  const s = calcularSimplificado({ valorFacturaUsd, weightGrams: input.weightGrams });

  const simplificado: LandedCostBreakdown = {
    regime: 'simplificado',
    applicable: s.bloqueo === undefined,
    ...(s.bloqueo ? { bloqueo: s.bloqueo } : {}),
    productUsd,
    domesticShippingUsd,
    valorFacturaUsd,
    courierUsd: courier.total,
    taxUsd: s.taxUsd,
    totalUsd: add(valorFacturaUsd, courier.total, s.taxUsd),
    tasaEfectivaPct: tasaEfectiva(s.taxUsd, valorFacturaUsd),
    explicacionImpuesto: s.explicacion,
    warnings: [...comunes, ...s.warnings],
    courierNombre: courier.courier.nombre,
    diasEstimados: courier.courier.diasEstimados,
  };

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
    'Los parámetros aduaneros de esta versión no están verificados contra fuente oficial. Verificá en aduanas.gub.uy.',
  RESIDENCIA_FISCAL_DESCONOCIDA:
    'No pudimos confirmar que el vendedor tenga residencia fiscal en EE.UU., así que calculamos CON IVA. Si la factura la emite una empresa estadounidense y el envío es de hasta USD 200, puede salir exento y el total sería menor.',
  VENDEDOR_NO_REGISTRADO:
    'Este vendedor no figura en el registro de Aduanas, que desde el 1/2/2027 es obligatorio para la exoneración de IVA. Calculamos con IVA.',
  COTIZACION_FALLBACK:
    'La cotización del dólar es un valor de respaldo, no la del día del BCU.',
  ENVIO_DOMESTICO_DESCONOCIDO:
    'La tienda no informa el costo de envío hasta el warehouse: lo calculamos como 0. Si lo cobra, suma al total y a la base imponible.',
};

/** Lo que consume de la franquicia, si se usa ese régimen. */
export function cupoQueConsume(result: LandedCostResult): number {
  return result.franquicia.applicable ? toUnits(result.franquicia.valorFacturaUsd) : 0;
}
