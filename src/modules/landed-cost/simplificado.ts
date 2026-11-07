/**
 * RÉGIMEN DE PRESTACIÓN ÚNICA ("simplificado", 60%)
 * ==================================================
 * Tasa única del 60% sobre el valor de factura, con pago mínimo de USD 20 y
 * tope de USD 800 por envío. Sin límite de cantidad de envíos por año, y lo
 * pueden usar personas jurídicas y con fines comerciales.
 *
 * El detalle que importa: con el mínimo de USD 20, un envío de USD 30 paga una
 * tasa EFECTIVA del 67%, no del 60%. Por eso el breakdown devuelve
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
  /** Total de la factura del exterior: producto + envío que cobra la tienda. */
  valorFacturaUsd: Money;
  weightGrams: number;
}): ResultadoSimplificado {
  const valor = toUnits(input.valorFacturaUsd);
  const pesoKg = input.weightGrams / 1000;

  if (valor > S.topeValorPorEnvioUsd) {
    return {
      taxUsd: zero('USD'),
      explicacion: `No entra en el régimen simplificado: supera el tope de USD ${S.topeValorPorEnvioUsd} por envío.`,
      bloqueo: {
        code: 'SUPERA_TOPE_VALOR',
        message: `El envío vale USD ${valor.toFixed(2)} y el tope es de USD ${S.topeValorPorEnvioUsd}. Habría que importarlo por régimen general, con despachante de aduana.`,
      },
      warnings: [],
    };
  }

  if (pesoKg > ADUANA_UY.topePesoPorEnvioKg) {
    return {
      taxUsd: zero('USD'),
      explicacion: `No entra en el régimen: supera los ${ADUANA_UY.topePesoPorEnvioKg} kg por envío.`,
      bloqueo: {
        code: 'SUPERA_TOPE_PESO',
        message: `El envío pesa ${pesoKg.toFixed(1)} kg y el régimen de envíos postales sólo cubre hasta ${ADUANA_UY.topePesoPorEnvioKg} kg.`,
      },
      warnings: [],
    };
  }

  const calculado = mul(input.valorFacturaUsd, S.tasa);
  const minimo = usd(S.minimoUsd);
  const taxUsd = max(calculado, minimo);
  const aplicoMinimo = gt(minimo, calculado);

  const explicacion = aplicoMinimo
    ? `Pago mínimo de USD ${S.minimoUsd} por envío (el ${(S.tasa * 100).toFixed(0)}% sobre USD ${valor.toFixed(2)} daría USD ${toUnits(calculado).toFixed(2)}).`
    : `Prestación única del ${(S.tasa * 100).toFixed(0)}% sobre USD ${valor.toFixed(2)}.`;

  return { taxUsd, explicacion, warnings: [] };
}
