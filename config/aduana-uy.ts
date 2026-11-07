/**
 * NORMATIVA ADUANERA URUGUAYA — ÚNICA FUENTE DE VERDAD
 * =====================================================
 *
 * Este archivo concentra TODA la normativa que usa el módulo `landed-cost`.
 * Si cambian las reglas, se cambia acá y en ningún otro lugar.
 *
 * Cómo actualizarlo: ver README.md § "Cómo actualizar la normativa".
 *
 * ⚠️  ESTADO DE VERIFICACIÓN: NO VERIFICADO CONTRA FUENTE OFICIAL.
 *     Los valores de abajo se tomaron de guías comerciales (couriers, medios,
 *     casas de cambio) que coinciden entre sí, pero NO del texto del
 *     Decreto 50/2026 ni de aduanas.gub.uy. Ver `FUENTES` y `PENDIENTES`.
 */

export type RegimenId = 'franquicia' | 'simplificado';

/** Sobre qué monto se calcula el impuesto. */
export type BaseImponible = 'producto' | 'producto+envio';

export interface NormativaAduanaUy {
  /** Fecha desde la cual rige este conjunto de reglas (ISO 8601). */
  readonly vigenciaDesde: string;
  /** Norma que la establece. */
  readonly norma: string;
  /** `true` sólo cuando alguien cotejó estos valores con la fuente oficial. */
  readonly verificadoContraFuenteOficial: boolean;
  /** Fecha de la última revisión de este archivo. */
  readonly revisadoEl: string;

  readonly franquicia: {
    /** Cantidad máxima de envíos amparados por franquicia, por año calendario. */
    readonly enviosPorAnioCalendario: number;
    /**
     * Cupo acumulado anual en valor de producto (USD). No se acumula entre
     * años: se resetea el 1 de enero.
     */
    readonly cupoAnualUsd: number;
    /** Tasa de IVA aplicable a las compras en franquicia. */
    readonly ivaTasa: number;
    /**
     * Mínimo de IVA a pagar por envío gravado (USD).
     * ⚠️ Ver PENDIENTES.minimoIva — valor no confirmado oficialmente.
     */
    readonly ivaMinimoUsd: number;
    /** Qué monto integra la base imponible del IVA. */
    readonly baseImponible: BaseImponible;
    /**
     * Exención de IVA para compras en comercios con sede fiscal en EE.UU.
     * (acuerdo marco TIFA).
     */
    readonly exencionEstadosUnidos: {
      readonly topePorEnvioUsd: number;
      /**
       * Si es `true`, no alcanza con que el paquete salga físicamente de
       * EE.UU.: el comercio vendedor debe tener sede fiscal allí.
       */
      readonly requiereSedeFiscalEnEeuu: boolean;
    };
    /** El IVA pagado NO consume cupo de los USD 800. */
    readonly ivaConsumeCupo: false;
  };

  readonly simplificado: {
    /** Tasa única sobre el valor del envío. */
    readonly tasa: number;
    /** Mínimo a pagar por envío (USD). */
    readonly minimoUsd: number;
    /** Valor máximo de mercadería por envío (USD). */
    readonly topeValorPorEnvioUsd: number;
    /**
     * Peso máximo por envío (kg).
     * ⚠️ Ver PENDIENTES.topePeso — valor no confirmado oficialmente.
     */
    readonly topePesoPorEnvioKg: number;
    /** Sin límite de cantidad de envíos por año. */
    readonly enviosPorAnioCalendario: null;
    readonly baseImponible: BaseImponible;
  };

  readonly requisitos: readonly string[];
}

export const ADUANA_UY: NormativaAduanaUy = {
  vigenciaDesde: '2026-05-01',
  norma: 'Decreto 50/2026 (régimen de envíos postales y courier)',
  verificadoContraFuenteOficial: false,
  revisadoEl: '2026-11-07',

  franquicia: {
    enviosPorAnioCalendario: 3,
    cupoAnualUsd: 800,
    ivaTasa: 0.22,
    ivaMinimoUsd: 20,
    baseImponible: 'producto',
    exencionEstadosUnidos: {
      topePorEnvioUsd: 200,
      requiereSedeFiscalEnEeuu: true,
    },
    ivaConsumeCupo: false,
  },

  simplificado: {
    tasa: 0.6,
    minimoUsd: 20,
    topeValorPorEnvioUsd: 800,
    topePesoPorEnvioKg: 20,
    enviosPorAnioCalendario: null,
    baseImponible: 'producto',
  },

  requisitos: [
    'Ser mayor de 18 años.',
    'Tener cédula de identidad uruguaya.',
    'La compra debe ser para uso personal, no comercial.',
  ],
} as const;

/**
 * Fuentes consultadas el 2026-11-07. Ninguna es oficial: todas son guías
 * comerciales o periodísticas que coinciden entre sí.
 */
export const FUENTES: readonly { nombre: string; url: string; tipo: 'comercial' | 'prensa' | 'oficial' }[] = [
  { nombre: 'Gripper — Régimen de encomiendas 2026', url: 'https://www.gripper.com.uy/regimen-de-encomiendas', tipo: 'comercial' },
  { nombre: 'Tiendamia — Franquicias Uruguay 2026', url: 'https://tiendamia.com.uy/franquicias-uruguay-2026', tipo: 'comercial' },
  { nombre: 'Telenoche — Compras online: qué cambia desde mayo', url: 'https://www.telenoche.com.uy/nacionales/compras-online-que-cambia-mayo-las-franquicias-y-el-nuevo-tope-us-800-n5397085', tipo: 'prensa' },
  { nombre: 'Compras por Internet UY — Claves 2026', url: 'https://comprasporinternet.uy/instructivos/compras-exterior-desde-uruguay-claves/', tipo: 'comercial' },
] as const;

/** Fuente oficial a cotejar. */
export const FUENTE_OFICIAL_URL = 'https://www.aduanas.gub.uy/';

/**
 * Puntos que hay que confirmar contra MEF / Dirección Nacional de Aduanas
 * antes de considerar este archivo confiable. Cada uno se muestra como
 * advertencia en la UI mientras `verificadoContraFuenteOficial` sea `false`.
 */
export const PENDIENTES = {
  minimoIva:
    'Mínimo de USD 20 de IVA por envío gravado en franquicia: aparece en guías de couriers, no confirmado en el decreto.',
  topePeso:
    'Tope de 20 kg por envío en el régimen simplificado: aparece en guías de couriers, no confirmado en el decreto.',
  sedeFiscalEeuu:
    'La exención de hasta USD 200 exigiría sede fiscal del comercio en EE.UU. (TIFA), no sólo origen físico del envío. Confirmar el criterio exacto.',
  arrastre2026:
    'Las compras hechas antes del 2026-05-01 contarían contra el cupo de USD 800 del año 2026. Confirmar.',
  cambioOctubre2026:
    'Una fuente menciona un cambio normativo con fecha 2026-10-01 sin detallar su contenido. Si existió, YA ESTÁ VIGENTE y no está reflejado acá.',
  baseImponible:
    'Si la base imponible del IVA y de la tasa del 60% es sólo el valor del producto o incluye el flete internacional. Se asumió sólo producto (el supuesto más favorable al usuario).',
} as const;

/** Texto legal fijo que se muestra en toda pantalla de resultado. */
export const DISCLAIMER =
  'Estimación orientativa, no es asesoramiento aduanero. Verificá en aduanas.gub.uy.';
