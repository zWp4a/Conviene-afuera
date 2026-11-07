/**
 * COURIERS QUE OPERAN A URUGUAY — TARIFAS CONFIGURABLES
 * ======================================================
 *
 * ⚠️  TODAS LAS TARIFAS DE ESTE ARCHIVO SON PLACEHOLDERS INVENTADOS.
 *     Están marcadas con `tarifasVerificadas: false` y la UI avisa al usuario
 *     cuando usa un courier no verificado. No publicar sin completarlas.
 *
 * Cómo actualizar: ver README.md § "Cómo actualizar las tarifas de courier".
 */

export type CourierId = 'aeropost' | 'miami-box' | 'gripper' | 'ups' | 'dac-courier' | 'generico';

/**
 * Tramo de peso con precio fijo. `hastaKg` es inclusivo.
 * El último tramo de la lista debe tener `hastaKg: Infinity`.
 */
export interface TramoPeso {
  readonly hastaKg: number;
  /** Costo del tramo en USD. */
  readonly usd: number;
}

export interface Courier {
  readonly id: CourierId;
  readonly nombre: string;
  /** `false` mientras las tarifas sean placeholders. */
  readonly tarifasVerificadas: boolean;
  /** URL donde el usuario crea la cuenta y obtiene su dirección en Miami. */
  readonly sitioWeb: string;
  /** Cargo fijo por envío, independiente del peso (USD). */
  readonly cargoFijoUsd: number;
  /**
   * Tramos de peso. Se usa el primero cuyo `hastaKg` sea >= al peso del envío.
   * Si está vacío, se usa `usdPorKg`.
   */
  readonly tramos: readonly TramoPeso[];
  /** Precio por kg, usado cuando no hay tramos o se excede el último tramo. */
  readonly usdPorKg: number;
  /** Peso mínimo facturable en kg (los couriers redondean hacia arriba). */
  readonly pesoMinimoFacturableKg: number;
  /** Si consolida varias compras en un mismo envío. */
  readonly consolidaEnvios: boolean;
  /** Días hábiles estimados desde que el paquete llega al warehouse de Miami. */
  readonly diasEstimados: { readonly min: number; readonly max: number };
  /** Países de origen desde los que opera. */
  readonly origenes: readonly string[];
  readonly notas?: string;
}

export const COURIERS: readonly Courier[] = [
  {
    id: 'aeropost',
    nombre: 'Aeropost',
    tarifasVerificadas: false, // TODO: verificar tarifa real
    sitioWeb: 'https://www.aeropost.com/uy',
    cargoFijoUsd: 6, // TODO: verificar tarifa real
    tramos: [
      { hastaKg: 0.5, usd: 9 }, // TODO: verificar tarifa real
      { hastaKg: 1, usd: 14 }, // TODO: verificar tarifa real
      { hastaKg: 2, usd: 22 }, // TODO: verificar tarifa real
      { hastaKg: Infinity, usd: 0 },
    ],
    usdPorKg: 11, // TODO: verificar tarifa real
    pesoMinimoFacturableKg: 0.5,
    consolidaEnvios: true,
    diasEstimados: { min: 7, max: 12 }, // TODO: verificar plazo real
    origenes: ['US'],
  },
  {
    id: 'miami-box',
    nombre: 'Miami Box',
    tarifasVerificadas: false, // TODO: verificar tarifa real
    sitioWeb: 'https://www.miamibox.com.uy/',
    cargoFijoUsd: 5, // TODO: verificar tarifa real
    tramos: [],
    usdPorKg: 12, // TODO: verificar tarifa real
    pesoMinimoFacturableKg: 0.5,
    consolidaEnvios: true,
    diasEstimados: { min: 8, max: 15 }, // TODO: verificar plazo real
    origenes: ['US'],
  },
  {
    id: 'gripper',
    nombre: 'Grupo Gripper',
    tarifasVerificadas: false, // TODO: verificar tarifa real
    sitioWeb: 'https://www.gripper.com.uy/',
    cargoFijoUsd: 7, // TODO: verificar tarifa real
    tramos: [],
    usdPorKg: 10, // TODO: verificar tarifa real
    pesoMinimoFacturableKg: 1,
    consolidaEnvios: true,
    diasEstimados: { min: 7, max: 14 }, // TODO: verificar plazo real
    origenes: ['US'],
  },
  {
    id: 'ups',
    nombre: 'UPS',
    tarifasVerificadas: false, // TODO: verificar tarifa real
    sitioWeb: 'https://www.ups.com/uy',
    cargoFijoUsd: 15, // TODO: verificar tarifa real
    tramos: [],
    usdPorKg: 24, // TODO: verificar tarifa real
    pesoMinimoFacturableKg: 0.5,
    consolidaEnvios: false,
    diasEstimados: { min: 3, max: 7 }, // TODO: verificar plazo real
    origenes: ['US', 'CN', 'DE', 'GB'],
    notas: 'Más caro y más rápido. No consolida: un paquete por compra.',
  },
  {
    id: 'dac-courier',
    nombre: 'DAC Courier',
    tarifasVerificadas: false, // TODO: verificar tarifa real
    sitioWeb: 'https://www.dac.com.uy/',
    cargoFijoUsd: 6, // TODO: verificar tarifa real
    tramos: [],
    usdPorKg: 11, // TODO: verificar tarifa real
    pesoMinimoFacturableKg: 0.5,
    consolidaEnvios: true,
    diasEstimados: { min: 8, max: 14 }, // TODO: verificar plazo real
    origenes: ['US'],
  },
  {
    id: 'generico',
    nombre: 'Courier genérico (estimación)',
    tarifasVerificadas: false, // TODO: verificar tarifa real
    sitioWeb: '',
    cargoFijoUsd: 6, // TODO: verificar tarifa real
    tramos: [],
    usdPorKg: 12, // TODO: verificar tarifa real
    pesoMinimoFacturableKg: 0.5,
    consolidaEnvios: true,
    diasEstimados: { min: 7, max: 15 }, // TODO: verificar plazo real
    origenes: ['US', 'CN', 'DE', 'GB', 'ES'],
    notas: 'Promedio de plaza. Se usa cuando ningún courier concreto cubre el origen.',
  },
] as const;

/** Courier que se usa por defecto cuando el usuario no elige uno. */
export const COURIER_POR_DEFECTO: CourierId = 'aeropost';

export function getCourier(id: CourierId): Courier {
  const c = COURIERS.find((x) => x.id === id);
  if (!c) throw new Error(`Courier desconocido: ${id}`);
  return c;
}

/** Couriers que operan desde un país de origen dado (ISO 3166-1 alpha-2). */
export function couriersParaOrigen(pais: string): readonly Courier[] {
  const propios = COURIERS.filter((c) => c.origenes.includes(pais.toUpperCase()));
  return propios.length > 0 ? propios : [getCourier('generico')];
}

/** `true` si alguna tarifa sigue siendo placeholder (para avisar en la UI). */
export const HAY_TARIFAS_SIN_VERIFICAR = COURIERS.some((c) => !c.tarifasVerificadas);
