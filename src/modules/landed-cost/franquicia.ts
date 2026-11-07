/**
 * RÉGIMEN DE FRANQUICIA
 * ======================
 * 3 envíos por año calendario, cupo acumulado de USD 800 en valor de factura.
 * IVA 22%, salvo envíos de hasta USD 200 embarcados por un vendedor con
 * residencia fiscal en un país con acuerdo comercial (hoy sólo EE.UU.).
 *
 * Tres cosas que se escapan fácil y están contempladas acá:
 *  - NO hay pago mínimo. El mínimo de USD 20 es del régimen simplificado.
 *  - El envío exonerado CONSUME cupo igual (Decreto 50/026 art. 3).
 *  - La base es el total de la factura: producto MÁS el envío que cobra la
 *    tienda del exterior, si figura en ella (art. 5). El courier uruguayo no.
 *
 * Todos los números salen de `config/aduana-uy.ts`.
 */
import { ADUANA_UY } from '@config/aduana-uy';
import { vendedorRegistradoEnDna } from '@config/vendedores-eeuu';
import { clampZero, mul, toUnits, zero, type Money } from '@/lib/money';
import type { Bloqueo, EstadoFranquicia, WarningCode } from './types';

const F = ADUANA_UY.franquicia;
const EX = F.exoneracionPorAcuerdo;

/** Evita el "EE.UU.." cuando el motivo ya termina con una abreviatura. */
function sinPuntoFinal(motivo: string): string {
  return motivo.endsWith('.') ? motivo.slice(0, -1) : motivo;
}

export interface ResultadoFranquicia {
  readonly taxUsd: Money;
  readonly exento: boolean;
  readonly explicacion: string;
  readonly bloqueo?: Bloqueo;
  readonly warnings: readonly WarningCode[];
  readonly consume: { readonly envios: number; readonly cupoUsd: number };
}

export function cupoRestanteUsd(estado: EstadoFranquicia): number {
  return Math.max(0, F.cupoAnualUsd - estado.cupoUsadoUsd);
}

export function enviosRestantes(estado: EstadoFranquicia): number {
  return Math.max(0, F.enviosPorAnioCalendario - estado.enviosUsados);
}

export interface ResultadoExoneracion {
  readonly aplica: boolean;
  readonly warnings: readonly WarningCode[];
  readonly motivo: string;
}

/**
 * ¿Aplica la exoneración de IVA por acuerdo comercial?
 *
 * Tres condiciones, y la segunda es la que se escapa: no alcanza con que el
 * paquete salga de Miami. El envío tiene que estar embarcado por un vendedor
 * con residencia fiscal en EE.UU., y eso se acredita con la factura.
 *
 * Desde el 1/2/2027 se agrega una tercera: el vendedor debe figurar en el
 * registro de Aduanas. Antes de esa fecha el registro no es exigible, pero si
 * el comercio ya figura lo usamos como prueba de la residencia fiscal — es el
 * dato más confiable que tenemos.
 *
 * Si no podemos confirmarlo, NO aplicamos la exoneración y lo advertimos:
 * preferimos subestimar el ahorro antes que prometer uno que no se cumple.
 */
export function aplicaExoneracionAcuerdo(input: {
  valorFacturaUsd: Money;
  originCountry: string;
  merchantTaxCountry?: string;
  merchantName?: string;
  /** Fecha de referencia; por defecto, hoy. Parametrizable para tests. */
  hoy?: Date;
}): ResultadoExoneracion {
  const valor = toUnits(input.valorFacturaUsd);
  const hoy = input.hoy ?? new Date();
  const registroExigible = hoy >= new Date(EX.exigeVendedorRegistradoDesde);
  const registrado = vendedorRegistradoEnDna(input.merchantName);

  if (valor > EX.topePorEnvioUsd) {
    return {
      aplica: false,
      warnings: [],
      motivo: `el envío supera los USD ${EX.topePorEnvioUsd} de la exoneración`,
    };
  }

  // El registro ante Aduanas es prueba suficiente de residencia fiscal.
  if (registrado) {
    return {
      aplica: true,
      warnings: [],
      motivo: 'el vendedor está registrado ante Aduanas como residente fiscal en EE.UU.',
    };
  }

  if (registroExigible) {
    return {
      aplica: false,
      warnings: ['VENDEDOR_NO_REGISTRADO'],
      motivo: `desde el ${EX.exigeVendedorRegistradoDesde} la exoneración exige que el vendedor esté registrado ante Aduanas, y este no figura en el listado`,
    };
  }

  // Antes del 1/2/2027 alcanza con acreditar la residencia fiscal por factura.
  if (input.merchantTaxCountry === undefined) {
    return {
      aplica: false,
      warnings: ['RESIDENCIA_FISCAL_DESCONOCIDA'],
      motivo: 'no pudimos confirmar que el vendedor tenga residencia fiscal en EE.UU.',
    };
  }

  if (!EX.paises.includes(input.merchantTaxCountry.toUpperCase())) {
    return {
      aplica: false,
      warnings: [],
      motivo: 'el vendedor no tiene residencia fiscal en un país con acuerdo comercial',
    };
  }

  return {
    aplica: true,
    warnings: [],
    motivo: 'vendedor con residencia fiscal en EE.UU.',
  };
}

export function calcularFranquicia(input: {
  /** Total de la factura del exterior: producto + envío que cobra la tienda. */
  valorFacturaUsd: Money;
  originCountry: string;
  merchantTaxCountry?: string;
  merchantName?: string;
  weightGrams: number;
  estado: EstadoFranquicia;
  hoy?: Date;
}): ResultadoFranquicia {
  const { valorFacturaUsd, estado } = input;
  const valor = toUnits(valorFacturaUsd);
  const consume = { envios: 1, cupoUsd: valor };

  // --- Tope de peso: aplica a todo el régimen, no sólo al simplificado ---
  const pesoKg = input.weightGrams / 1000;
  if (pesoKg > ADUANA_UY.topePesoPorEnvioKg) {
    return {
      taxUsd: zero('USD'),
      exento: false,
      explicacion: `No entra en el régimen: supera los ${ADUANA_UY.topePesoPorEnvioKg} kg por envío.`,
      bloqueo: {
        code: 'SUPERA_TOPE_PESO',
        message: `El envío pesa ${pesoKg.toFixed(1)} kg y el régimen de envíos postales sólo cubre hasta ${ADUANA_UY.topePesoPorEnvioKg} kg.`,
      },
      warnings: [],
      consume,
    };
  }

  // --- ¿Le queda franquicia? ---
  if (enviosRestantes(estado) <= 0) {
    return {
      taxUsd: zero('USD'),
      exento: false,
      explicacion: `No podés usar franquicia: ya usaste los ${F.enviosPorAnioCalendario} envíos del año.`,
      bloqueo: {
        code: 'ENVIOS_AGOTADOS',
        message: `Ya usaste los ${F.enviosPorAnioCalendario} envíos de franquicia de este año. El cupo se resetea en enero.`,
      },
      warnings: [],
      consume,
    };
  }

  const restante = cupoRestanteUsd(estado);
  if (valor > restante) {
    return {
      taxUsd: zero('USD'),
      exento: false,
      explicacion: `No podés usar franquicia: te quedan USD ${restante.toFixed(2)} de cupo y el envío vale USD ${valor.toFixed(2)}.`,
      bloqueo: {
        code: 'CUPO_INSUFICIENTE',
        message: `Te quedan USD ${restante.toFixed(2)} de los USD ${F.cupoAnualUsd} anuales, y este envío vale USD ${valor.toFixed(2)}.`,
      },
      warnings: [],
      consume,
    };
  }

  // --- Exoneración por acuerdo comercial ---
  const exo = aplicaExoneracionAcuerdo({
    valorFacturaUsd,
    originCountry: input.originCountry,
    ...(input.merchantTaxCountry ? { merchantTaxCountry: input.merchantTaxCountry } : {}),
    ...(input.merchantName ? { merchantName: input.merchantName } : {}),
    ...(input.hoy ? { hoy: input.hoy } : {}),
  });

  if (exo.aplica) {
    return {
      taxUsd: zero('USD'),
      exento: true,
      explicacion: `Exento de IVA: hasta USD ${EX.topePorEnvioUsd} por envío, ${sinPuntoFinal(exo.motivo)}. Igual te consume cupo.`,
      warnings: exo.warnings,
      consume,
    };
  }

  // --- IVA. Sin mínimo: el mínimo de USD 20 es del régimen simplificado. ---
  const taxUsd = mul(valorFacturaUsd, F.ivaTasa);

  return {
    taxUsd: clampZero(taxUsd),
    exento: false,
    explicacion: `IVA ${(F.ivaTasa * 100).toFixed(0)}% sobre USD ${valor.toFixed(2)} — ${sinPuntoFinal(exo.motivo)}.`,
    warnings: exo.warnings,
    consume,
  };
}
