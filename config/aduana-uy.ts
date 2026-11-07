/**
 * NORMATIVA ADUANERA URUGUAYA — ÚNICA FUENTE DE VERDAD
 * =====================================================
 *
 * Este archivo concentra TODA la normativa que usa el módulo `landed-cost`.
 * Si cambian las reglas, se cambia acá y en ningún otro lado.
 *
 * Cómo actualizarlo: ver README.md § "Cómo actualizar la normativa".
 *
 * ✅ ESTADO: VERIFICADO CONTRA FUENTE OFICIAL el 2026-11-07.
 *    Cotejado contra el texto del Decreto N° 50/026 en IMPO, los artículos
 *    627 a 635 de la Ley N° 20.446, y las páginas de la Dirección Nacional
 *    de Aduanas sobre cada régimen. Ver `FUENTES`.
 */

export type RegimenId = 'franquicia' | 'simplificado';

/**
 * Qué integra la base imponible.
 *
 * `factura`: el total de la factura original de compra, incluidos todos los
 * conceptos adicionados en ella (Decreto 50/026 art. 5). Es decir: producto
 * MÁS el envío que cobra la tienda del exterior, si figura en la factura.
 * NO incluye lo que cobra el courier en Uruguay, que no está en esa factura.
 */
export type BaseImponible = 'factura';

export interface NormativaAduanaUy {
  /** Fecha desde la cual rige este conjunto de reglas (ISO 8601). */
  readonly vigenciaDesde: string;
  readonly norma: string;
  readonly normaUrl: string;
  /** Ley que el decreto reglamenta. */
  readonly leyHabilitante: string;
  readonly verificadoContraFuenteOficial: boolean;
  readonly revisadoEl: string;

  /**
   * Peso máximo por envío, en kg. Aplica a TODO el régimen de envíos
   * postales internacionales, no sólo al simplificado: el Decreto 50/026
   * art. 1 define su propio alcance como los envíos "cuyo peso unitario no
   * exceda de 20 (veinte) kilogramos".
   */
  readonly topePesoPorEnvioKg: number;

  readonly franquicia: {
    readonly enviosPorAnioCalendario: number;
    /**
     * Cupo acumulado anual en valor de factura (USD). No se acumula entre
     * años. Importante: los envíos exonerados de IVA TAMBIÉN consumen cupo
     * (Decreto 50/026 art. 3: "el valor de dichos envíos se imputará al cupo
     * anual establecido para la franquicia").
     */
    readonly cupoAnualUsd: number;
    readonly ivaTasa: number;
    readonly baseImponible: BaseImponible;
    /**
     * Exoneración de IVA por acuerdo comercial internacional.
     * Hoy el único país con acuerdo vigente en la materia es EE.UU.
     */
    readonly exoneracionPorAcuerdo: {
      readonly paises: readonly string[];
      readonly topePorEnvioUsd: number;
      /**
       * No alcanza con que el paquete salga físicamente del país: el envío
       * debe estar "embarcado por el vendedor residente fiscal" allí, y la
       * residencia se acredita con la factura.
       */
      readonly requiereResidenciaFiscalDelVendedor: true;
      /**
       * Desde esta fecha, además, el emisor de la factura debe estar
       * registrado ante la Dirección Nacional de Aduanas.
       * Ver `config/vendedores-eeuu.ts`.
       */
      readonly exigeVendedorRegistradoDesde: string;
    };
    /** Los libros y medicamentos de uso personal no computan contra el cupo. */
    readonly exceptuadosDelCupo: readonly string[];
    /** El IVA pagado no se imputa al cupo: sólo el valor de factura. */
    readonly ivaConsumeCupo: false;
    /**
     * El régimen de franquicia NO tiene un pago mínimo. El mínimo de USD 20
     * pertenece exclusivamente al régimen de prestación única (ver abajo).
     */
    readonly pagoMinimoUsd: null;
  };

  readonly simplificado: {
    readonly tasa: number;
    /** Pago mínimo por envío (Ley 20.446 art. 627 y Decreto 50/026 art. 2). */
    readonly minimoUsd: number;
    readonly topeValorPorEnvioUsd: number;
    /** Sin límite de cantidad de envíos por año. */
    readonly enviosPorAnioCalendario: null;
    readonly baseImponible: BaseImponible;
    /** A diferencia de la franquicia, lo pueden usar personas jurídicas. */
    readonly admitePersonasJuridicas: true;
    readonly admiteFinesComerciales: true;
  };

  /** Requisitos del régimen de franquicia (Decreto 50/026 art. 4). */
  readonly requisitosFranquicia: readonly string[];
  /** Mercadería excluida de los dos regímenes (Decreto 50/026 art. 7). */
  readonly exclusiones: readonly string[];
}

export const ADUANA_UY: NormativaAduanaUy = {
  vigenciaDesde: '2026-05-01',
  norma: 'Decreto N° 50/026 de 12/03/2026',
  normaUrl: 'https://www.impo.com.uy/bases/decretos/50-2026',
  leyHabilitante: 'Ley N° 20.446 de 16/12/2025, artículos 627 a 635',
  verificadoContraFuenteOficial: true,
  revisadoEl: '2026-11-07',

  topePesoPorEnvioKg: 20,

  franquicia: {
    enviosPorAnioCalendario: 3,
    cupoAnualUsd: 800,
    ivaTasa: 0.22,
    baseImponible: 'factura',
    exoneracionPorAcuerdo: {
      paises: ['US'],
      topePorEnvioUsd: 200,
      requiereResidenciaFiscalDelVendedor: true,
      exigeVendedorRegistradoDesde: '2027-02-01',
    },
    exceptuadosDelCupo: ['libros', 'medicamentos de uso personal (con autorización del MSP)'],
    ivaConsumeCupo: false,
    pagoMinimoUsd: null,
  },

  simplificado: {
    tasa: 0.6,
    minimoUsd: 20,
    topeValorPorEnvioUsd: 800,
    enviosPorAnioCalendario: null,
    baseImponible: 'factura',
    admitePersonasJuridicas: true,
    admiteFinesComerciales: true,
  },

  requisitosFranquicia: [
    'Registrarte por única vez ante la Dirección Nacional de Aduanas antes de usar la franquicia.',
    'Ser persona física mayor de edad con documento de identidad uruguayo.',
    'Que la compra sea para uso personal y sin fines comerciales.',
    'Pagar con tarjeta de crédito o débito internacional, o dinero electrónico internacional, emitidos por una institución regulada por el BCU.',
    'Que el titular del medio de pago, el titular de la compra y el destinatario del envío sean la misma persona.',
    'Autorizar a la administradora de la tarjeta a confirmarle a Aduanas que la titularidad coincide.',
    'Cumplir con el control de identidad digital de Aduanas.',
  ],

  exclusiones: [
    'Mercadería gravada por el IMESI.',
    'Mercadería que requiera autorización de otro organismo y no la tenga.',
  ],
} as const;

/** Fuentes consultadas y cotejadas el 2026-11-07. */
export const FUENTES: readonly { nombre: string; url: string; tipo: 'oficial' | 'comercial' | 'prensa' }[] = [
  {
    nombre: 'Decreto N° 50/026 — texto actualizado (IMPO)',
    url: 'https://www.impo.com.uy/bases/decretos/50-2026',
    tipo: 'oficial',
  },
  {
    nombre: 'Ley N° 20.446 art. 627 (IMPO)',
    url: 'https://www.impo.com.uy/bases/leyes/20446-2025/627',
    tipo: 'oficial',
  },
  {
    nombre: 'DNA — Régimen de franquicia',
    url: 'https://www.aduanas.gub.uy/innovaportal/v/28221/1/innova.front/',
    tipo: 'oficial',
  },
  {
    nombre: 'DNA — Régimen con prestación única (60%)',
    url: 'https://www.aduanas.gub.uy/innovaportal/v/28222/1/innova.front/',
    tipo: 'oficial',
  },
  {
    nombre: 'DNA — Envíos postales internacionales',
    url: 'https://www.aduanas.gub.uy/innovaportal/v/28219/1/innova.front/encomiendas-postales-internacionales.html',
    tipo: 'oficial',
  },
] as const;

export const FUENTE_OFICIAL_URL =
  'https://www.aduanas.gub.uy/innovaportal/v/28219/1/innova.front/encomiendas-postales-internacionales.html';

/**
 * Puntos que siguen sin resolverse. Cuando este objeto está vacío y
 * `verificadoContraFuenteOficial` es `true`, la UI no muestra advertencia
 * sobre la normativa.
 */
export const PENDIENTES: Readonly<Record<string, string>> = {};

/**
 * Transición 2026 (Decreto 50/026 art. 18): durante 2026 conviven el régimen
 * anterior (Decreto 356/014, hasta el 30/04) y el nuevo. Para contar el tope
 * de USD 800 y la cantidad de envíos se toman TODOS los del año civil, con
 * cualquiera de los dos regímenes.
 */
export const TRANSICION_2026 =
  'Durante 2026, para contar tus 3 envíos y tus USD 800 se suman también las compras que hiciste antes del 1 de mayo, con el régimen anterior.';

export const DISCLAIMER =
  'Estimación orientativa, no es asesoramiento aduanero. Verificá en aduanas.gub.uy.';
