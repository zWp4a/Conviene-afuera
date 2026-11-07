/**
 * RÉGIMEN DE FRANQUICIA
 * ======================
 * 3 envíos por año calendario, cupo acumulado de USD 800 en valor de producto.
 * IVA 22%, con mínimo por envío, salvo compras de hasta USD 200 en comercios
 * con sede fiscal en EE.UU. (exentas).
 *
 * Todos los números salen de `config/aduana-uy.ts`.
 */
import { ADUANA_UY } from '@config/aduana-uy';
import { clampZero, gt, max, mul, toUnits, usd, zero, type Money } from '@/lib/money';
import type { Bloqueo, EstadoFranquicia, WarningCode } from './types';

const F = ADUANA_UY.franquicia;

export interface ResultadoFranquicia {
  readonly taxUsd: Money;
  readonly exento: boolean;
  readonly explicacion: string;
  readonly bloqueo?: Bloqueo;
  readonly warnings: readonly WarningCode[];
  readonly consume: { readonly envios: number; readonly cupoUsd: number };
}

/** Cupo en USD que le queda al usuario este año. */
export function cupoRestanteUsd(estado: EstadoFranquicia): number {
  return Math.max(0, F.cupoAnualUsd - estado.cupoUsadoUsd);
}

/** Envíos de franquicia que le quedan este año. */
export function enviosRestantes(estado: EstadoFranquicia): number {
  return Math.max(0, F.enviosPorAnioCalendario - estado.enviosUsados);
}

/**
 * ¿Aplica la exención de IVA?
 *
 * Dos condiciones, y la segunda es la que se escapa fácil: no alcanza con que
 * el paquete salga de Miami — el comercio tiene que tributar en EE.UU.
 * Si no sabemos la sede fiscal, NO aplicamos la exención y lo advertimos:
 * preferimos subestimar el ahorro antes que prometer uno que no se cumple.
 */
export function aplicaExencionEeuu(input: {
  productUsd: Money;
  originCountry: string;
  merchantTaxCountry?: string;
}): { aplica: boolean; warnings: readonly WarningCode[]; motivo: string } {
  const ex = F.exencionEstadosUnidos;
  const valor = toUnits(input.productUsd);

  if (valor > ex.topePorEnvioUsd) {
    return {
      aplica: false,
      warnings: [],
      motivo: `supera los USD ${ex.topePorEnvioUsd} de la exención`,
    };
  }

  if (!ex.requiereSedeFiscalEnEeuu) {
    const aplica = input.originCountry.toUpperCase() === 'US';
    return { aplica, warnings: [], motivo: aplica ? 'envío desde EE.UU.' : 'no sale de EE.UU.' };
  }

  if (input.merchantTaxCountry === undefined) {
    return {
      aplica: false,
      warnings: ['SEDE_FISCAL_DESCONOCIDA'],
      motivo: 'no sabemos si el comercio tiene sede fiscal en EE.UU.',
    };
  }

  if (input.merchantTaxCountry.toUpperCase() !== 'US') {
    return {
      aplica: false,
      warnings: [],
      motivo: 'el comercio no tributa en EE.UU.',
    };
  }

  return { aplica: true, warnings: [], motivo: 'comercio con sede fiscal en EE.UU.' };
}

export function calcularFranquicia(input: {
  productUsd: Money;
  shippingUsd: Money;
  originCountry: string;
  merchantTaxCountry?: string;
  estado: EstadoFranquicia;
}): ResultadoFranquicia {
  const { productUsd, estado } = input;
  const valorProducto = toUnits(productUsd);
  const consume = { envios: 1, cupoUsd: valorProducto };

  // --- Bloqueos: ¿puede usar franquicia? ---
  if (enviosRestantes(estado) <= 0) {
    return {
      taxUsd: zero('USD'),
      exento: false,
      explicacion: 'No podés usar franquicia: ya usaste los 3 envíos del año.',
      bloqueo: {
        code: 'ENVIOS_AGOTADOS',
        message: `Ya usaste los ${F.enviosPorAnioCalendario} envíos de franquicia de este año. El cupo se resetea en enero.`,
      },
      warnings: [],
      consume,
    };
  }

  const restante = cupoRestanteUsd(estado);
  if (valorProducto > restante) {
    return {
      taxUsd: zero('USD'),
      exento: false,
      explicacion: `No podés usar franquicia: te quedan USD ${restante} de cupo y el producto vale USD ${valorProducto.toFixed(2)}.`,
      bloqueo: {
        code: 'CUPO_INSUFICIENTE',
        message: `Te quedan USD ${restante.toFixed(2)} de los USD ${F.cupoAnualUsd} anuales, y este producto vale USD ${valorProducto.toFixed(2)}.`,
      },
      warnings: [],
      consume,
    };
  }

  // --- Base imponible ---
  const base =
    F.baseImponible === 'producto+envio'
      ? { cents: productUsd.cents + input.shippingUsd.cents, currency: 'USD' as const }
      : productUsd;

  // --- Exención EE.UU. ---
  const exencion = aplicaExencionEeuu({
    productUsd,
    originCountry: input.originCountry,
    ...(input.merchantTaxCountry ? { merchantTaxCountry: input.merchantTaxCountry } : {}),
  });

  if (exencion.aplica) {
    return {
      taxUsd: zero('USD'),
      exento: true,
      explicacion: `Exento de IVA: compra de hasta USD ${F.exencionEstadosUnidos.topePorEnvioUsd} en ${exencion.motivo}.`,
      warnings: exencion.warnings,
      consume,
    };
  }

  // --- IVA con mínimo ---
  const ivaCalculado = mul(base, F.ivaTasa);
  const minimo = usd(F.ivaMinimoUsd);
  const taxUsd = max(ivaCalculado, minimo);
  const aplicoMinimo = gt(minimo, ivaCalculado);

  const explicacion = aplicoMinimo
    ? `IVA mínimo de USD ${F.ivaMinimoUsd} por envío (el ${(F.ivaTasa * 100).toFixed(0)}% sobre USD ${toUnits(base).toFixed(2)} daría USD ${toUnits(ivaCalculado).toFixed(2)}).`
    : `IVA ${(F.ivaTasa * 100).toFixed(0)}% sobre USD ${toUnits(base).toFixed(2)} — ${exencion.motivo}.`;

  return {
    taxUsd: clampZero(taxUsd),
    exento: false,
    explicacion,
    warnings: exencion.warnings,
    consume,
  };
}
