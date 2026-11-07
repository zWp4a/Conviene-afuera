/**
 * RÉGIMEN SIMPLIFICADO
 * =====================
 * Tasa única del 60% sobre el valor del envío, con mínimo de USD 20 y tope de
 * USD 800 (y 20 kg) por envío. Sin límite de cantidad de envíos por año.
 *
 * El detalle que importa: con el mínimo de USD 20, un producto de USD 30 paga
 * una tasa EFECTIVA del 67%, no del 60%. Por eso el breakdown devuelve
 * `tasaEfectivaPct` y no se asume la nominal en ningún lado.
 */
import { ADUANA_UY } from '@config/aduana-uy';
import { gt, max, mul, toUnits, usd, zero, type Money } from '@/lib/money';
import type { Bloqueo, WarningCode } from './types';

const S = ADUANA_UY.simplificado;

export interface ResultadoSimplificado {
  readonly taxUsd: Money;
  readonly explicacion: string;
  readonly bloqueo?: Bloqueo;
  readonly warnings: readonly WarningCode[];
}

export function calcularSimplificado(input: {
  productUsd: Money;
  shippingUsd: Money;
  weightGrams: number;
}): ResultadoSimplificado {
  const valorProducto = toUnits(input.productUsd);
  const pesoKg = input.weightGrams / 1000;

  // --- Topes ---
  if (valorProducto > S.topeValorPorEnvioUsd) {
    return {
      taxUsd: zero('USD'),
      explicacion: `No entra en el régimen simplificado: supera el tope de USD ${S.topeValorPorEnvioUsd} por envío.`,
      bloqueo: {
        code: 'SUPERA_TOPE_VALOR',
        message: `El producto vale USD ${valorProducto.toFixed(2)} y el tope por envío es de USD ${S.topeValorPorEnvioUsd}. Habría que importarlo por despacho común, con agente de aduana.`,
      },
      warnings: [],
    };
  }

  if (pesoKg > S.topePesoPorEnvioKg) {
    return {
      taxUsd: zero('USD'),
      explicacion: `No entra en el régimen simplificado: supera el tope de ${S.topePesoPorEnvioKg} kg por envío.`,
      bloqueo: {
        code: 'SUPERA_TOPE_PESO',
        message: `El envío pesa ${pesoKg.toFixed(1)} kg y el tope es de ${S.topePesoPorEnvioKg} kg.`,
      },
      warnings: [],
    };
  }

  // --- Tasa única con mínimo ---
  const base =
    S.baseImponible === 'producto+envio'
      ? { cents: input.productUsd.cents + input.shippingUsd.cents, currency: 'USD' as const }
      : input.productUsd;

  const calculado = mul(base, S.tasa);
  const minimo = usd(S.minimoUsd);
  const taxUsd = max(calculado, minimo);
  const aplicoMinimo = gt(minimo, calculado);

  const explicacion = aplicoMinimo
    ? `Mínimo de USD ${S.minimoUsd} por envío (el ${(S.tasa * 100).toFixed(0)}% sobre USD ${toUnits(base).toFixed(2)} daría USD ${toUnits(calculado).toFixed(2)}).`
    : `Tasa única del ${(S.tasa * 100).toFixed(0)}% sobre USD ${toUnits(base).toFixed(2)}.`;

  return { taxUsd, explicacion, warnings: [] };
}
