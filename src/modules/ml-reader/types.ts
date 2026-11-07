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
}

export type MLReaderErrorCode =
  | 'URL_INVALIDA'
  | 'NO_ES_MERCADOLIBRE_UY'
  | 'ITEM_NO_ENCONTRADO'
  | 'SIN_CREDENCIALES'
  | 'API_NO_DISPONIBLE';

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
