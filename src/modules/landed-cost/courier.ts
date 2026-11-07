/**
 * COSTO DE COURIER
 * =================
 * Toda la tarifa sale de `config/couriers-uy.ts`. Acá sólo está la lógica de
 * cómo se aplica: peso mínimo facturable, tramos, y precio por kg.
 */
import { getCourier, type Courier, type CourierId } from '@config/couriers-uy';
import { add, usd, type Money } from '@/lib/money';

export interface CostoCourier {
  readonly total: Money;
  readonly courier: Courier;
  /** Peso que se facturó, después de aplicar mínimos y redondeo. */
  readonly pesoFacturadoKg: number;
  readonly tarifaVerificada: boolean;
}

export function costoCourier(courierId: CourierId, weightGrams: number): CostoCourier {
  const courier = getCourier(courierId);

  // Los couriers redondean hacia arriba y cobran un mínimo.
  const kgReales = Math.max(0, weightGrams) / 1000;
  const kgConMinimo = Math.max(kgReales, courier.pesoMinimoFacturableKg);
  // Redondeo al medio kilo hacia arriba, que es lo habitual en plaza.
  const pesoFacturadoKg = Math.ceil(kgConMinimo * 2) / 2;

  let variable: Money;
  const tramo = courier.tramos.find((t) => pesoFacturadoKg <= t.hastaKg);
  if (tramo && Number.isFinite(tramo.hastaKg)) {
    variable = usd(tramo.usd);
  } else {
    variable = usd(pesoFacturadoKg * courier.usdPorKg);
  }

  return {
    total: add(usd(courier.cargoFijoUsd), variable),
    courier,
    pesoFacturadoKg,
    tarifaVerificada: courier.tarifasVerificadas,
  };
}
