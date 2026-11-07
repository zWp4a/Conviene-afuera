import type { Money } from '@/lib/money';

/** Atributos del producto, normalizados desde los attributes de ML. */
export interface ProductAttributes {
  readonly brand?: string;
  readonly model?: string;
  /** EAN / UPC / GTIN. Si existe, el matcher lo usa y no llama al LLM. */
  readonly gtin?: string;
  /** Capacidad de almacenamiento normalizada, ej: "256 GB". */
  readonly capacity?: string;
  readonly color?: string;
  /** Resto de atributos sin normalizar, por si el matcher los necesita. */
  readonly extra?: Readonly<Record<string, string>>;
}

export interface MLSeller {
  readonly id: number;
  readonly nickname?: string;
  /** `true` si es tienda oficial (importa para la garantía local). */
  readonly esTiendaOficial: boolean;
  readonly reputacion?: string;
}

export interface MLShipping {
  readonly envioGratis: boolean;
  readonly esFull: boolean;
  /** Costo de envío en la moneda del producto, si no es gratis. */
  readonly costo?: Money;
}

/** Producto de Mercado Libre Uruguay, ya normalizado. */
export interface MLProduct {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly price: Money;
  readonly attributes: ProductAttributes;
  /** Peso del producto si ML lo informa. `undefined` ⇒ hay que estimarlo. */
  readonly weightGrams?: number;
  readonly categoryId: string;
  readonly condition: 'new' | 'used' | 'refurbished' | 'unknown';
  readonly seller: MLSeller;
  readonly shipping: MLShipping;
  readonly images: readonly string[];
  readonly warrantyText?: string;
  /** De dónde salió el dato: para que la UI pueda avisar cuando es mock. */
  readonly source: 'api' | 'mock';
  /**
   * De dónde salió el PRECIO, que no siempre es de donde salió el resto.
   *
   * `catalogo`: lo dio Mercado Libre. Sólo pasa cuando algún vendedor ganó el
   *             buy box del producto, que es ~1 de cada 12 casos.
   * `usuario`:  lo escribió la persona mirando la pantalla de ML.
   * `mock`:     datos de ejemplo.
   *
   * La UI tiene que decir cuál es: un precio que escribió el usuario y uno
   * que confirmó ML no merecen la misma confianza.
   */
  readonly priceSource: 'catalogo' | 'usuario' | 'mock';
}

export type MLReaderErrorCode =
  | 'URL_INVALIDA'
  | 'NO_ES_MERCADOLIBRE_UY'
  | 'ITEM_NO_ENCONTRADO'
  | 'SIN_CREDENCIALES'
  | 'API_NO_DISPONIBLE'
  /**
   * Identificamos el producto pero no su precio. No es un error del usuario
   * ni nuestro: Mercado Libre cerró el acceso a los precios de publicaciones
   * para apps no certificadas, y sólo ~1 de cada 12 productos del catálogo
   * tiene un precio visible. Se resuelve pidiéndole el precio a la persona.
   */
  | 'PRECIO_NO_DISPONIBLE';

export class MLReaderError extends Error {
  constructor(
    readonly code: MLReaderErrorCode,
    /** Mensaje apto para mostrarle al usuario, en español rioplatense. */
    readonly userMessage: string,
    cause?: unknown,
  ) {
    super(`${code}: ${userMessage}`);
    this.name = 'MLReaderError';
    if (cause !== undefined) this.cause = cause;
  }
}
