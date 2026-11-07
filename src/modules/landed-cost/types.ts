import type { CourierId } from '@config/couriers-uy';
import type { RegimenId } from '@config/aduana-uy';
import type { Money } from '@/lib/money';

/** Códigos de advertencia que la UI traduce a texto para el usuario. */
export type WarningCode =
  | 'PESO_ESTIMADO'
  | 'TARIFA_COURIER_SIN_VERIFICAR'
  | 'NORMATIVA_SIN_VERIFICAR'
  | 'SEDE_FISCAL_DESCONOCIDA'
  | 'COTIZACION_FALLBACK'
  | 'ENVIO_DOMESTICO_DESCONOCIDO';

/** Por qué un régimen no se puede usar para este envío. */
export type BloqueoCode =
  | 'CUPO_INSUFICIENTE'
  | 'ENVIOS_AGOTADOS'
  | 'SUPERA_TOPE_VALOR'
  | 'SUPERA_TOPE_PESO';

export interface Bloqueo {
  readonly code: BloqueoCode;
  readonly message: string;
}

/** Lo que el usuario ya usó de su franquicia este año. */
export interface EstadoFranquicia {
  /** Envíos de franquicia ya usados en el año calendario. */
  readonly enviosUsados: number;
  /** Cupo en USD ya consumido en el año calendario. */
  readonly cupoUsadoUsd: number;
  /**
   * `true` cuando el usuario no respondió y asumimos franquicia disponible.
   * La UI tiene que aclararlo.
   */
  readonly asumido: boolean;
}

export const FRANQUICIA_DISPONIBLE: EstadoFranquicia = {
  enviosUsados: 0,
  cupoUsadoUsd: 0,
  asumido: true,
};

export interface LandedCostInput {
  /** Valor del producto en el exterior. */
  readonly productPrice: Money;
  /** Envío doméstico en el país de origen (hasta el warehouse). */
  readonly domesticShipping?: Money;
  /** Peso del envío en gramos. */
  readonly weightGrams: number;
  /** `true` si el peso salió de la tabla de categorías y no del producto. */
  readonly weightIsEstimated: boolean;
  /** País desde donde sale el paquete (ISO alpha-2). */
  readonly originCountry: string;
  /** País de sede fiscal del comercio. Define la exención de IVA. */
  readonly merchantTaxCountry?: string;
  readonly courierId: CourierId;
  readonly franquicia?: EstadoFranquicia;
}

/** Desglose del costo puesto en Uruguay, para un régimen. */
export interface LandedCostBreakdown {
  readonly regime: RegimenId;
  /** `false` cuando el régimen no se puede usar: ver `bloqueo`. */
  readonly applicable: boolean;
  readonly bloqueo?: Bloqueo;

  readonly productUsd: Money;
  readonly domesticShippingUsd: Money;
  readonly courierUsd: Money;
  readonly taxUsd: Money;
  readonly totalUsd: Money;

  /** Tasa efectiva de impuesto sobre el valor del producto, en %. */
  readonly tasaEfectivaPct: number;
  /** Explicación del impuesto en una línea, para mostrar en la UI. */
  readonly explicacionImpuesto: string;
  /** Qué consume de la franquicia, si corresponde. */
  readonly consumeFranquicia?: { readonly envios: number; readonly cupoUsd: number };
  readonly warnings: readonly WarningCode[];
  readonly courierNombre: string;
  readonly diasEstimados: { readonly min: number; readonly max: number };
}

export interface LandedCostResult {
  /** Siempre los dos escenarios, con `applicable` para saber cuál sirve. */
  readonly franquicia: LandedCostBreakdown;
  readonly simplificado: LandedCostBreakdown;
  /** El más barato entre los aplicables. `undefined` si ninguno sirve. */
  readonly recomendado?: LandedCostBreakdown;
  readonly peso: { readonly gramos: number; readonly esEstimado: boolean };
}
