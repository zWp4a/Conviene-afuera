/**
 * PESOS ESTIMADOS POR CATEGORÍA
 * ==============================
 *
 * Se usa SÓLO cuando ni el producto de Mercado Libre ni la oferta del exterior
 * informan peso. Todo cálculo que dependa de esta tabla se marca con la
 * advertencia `PESO_ESTIMADO` y la UI lo aclara al usuario.
 *
 * Los `prefijoCategoriaML` son prefijos de category_id de Mercado Libre
 * Uruguay (site MLU). Se evalúan de más específico a menos específico.
 */

export interface PesoCategoria {
  /** Prefijo de category_id de ML, o `'*'` para el fallback global. */
  readonly prefijoCategoriaML: string;
  readonly etiqueta: string;
  /** Peso con packaging, en gramos. */
  readonly gramos: number;
}

/** Ordenada de más específica a menos específica. */
export const PESOS_POR_CATEGORIA: readonly PesoCategoria[] = [
  { prefijoCategoriaML: 'MLU1051', etiqueta: 'Celulares y smartphones', gramos: 600 },
  { prefijoCategoriaML: 'MLU1648', etiqueta: 'Computación', gramos: 2500 },
  { prefijoCategoriaML: 'MLU1652', etiqueta: 'Notebooks', gramos: 2800 },
  { prefijoCategoriaML: 'MLU1000', etiqueta: 'Electrónica, audio y video', gramos: 1500 },
  { prefijoCategoriaML: 'MLU1002', etiqueta: 'Audio y auriculares', gramos: 500 },
  { prefijoCategoriaML: 'MLU1144', etiqueta: 'Consolas y videojuegos', gramos: 1200 },
  { prefijoCategoriaML: 'MLU1276', etiqueta: 'Deportes y fitness', gramos: 1800 },
  { prefijoCategoriaML: 'MLU1430', etiqueta: 'Ropa y accesorios', gramos: 700 },
  { prefijoCategoriaML: 'MLU1246', etiqueta: 'Belleza y cuidado personal', gramos: 400 },
  { prefijoCategoriaML: 'MLU1574', etiqueta: 'Hogar y muebles', gramos: 3000 },
  { prefijoCategoriaML: 'MLU1499', etiqueta: 'Industrias y oficinas', gramos: 2000 },
  { prefijoCategoriaML: 'MLU1132', etiqueta: 'Juguetes', gramos: 900 },
  { prefijoCategoriaML: 'MLU3937', etiqueta: 'Relojes y joyas', gramos: 300 },
  { prefijoCategoriaML: 'MLU5726', etiqueta: 'Electrodomésticos', gramos: 4000 },
  { prefijoCategoriaML: 'MLU1743', etiqueta: 'Autopartes y accesorios', gramos: 2000 },
  { prefijoCategoriaML: '*', etiqueta: 'Sin categoría conocida', gramos: 1000 },
] as const;

export interface PesoEstimado {
  readonly gramos: number;
  readonly etiqueta: string;
  /** Siempre `true`: todo lo que sale de acá es una estimación. */
  readonly esEstimado: true;
}

/** Peso estimado para una categoría de ML. Nunca falla: cae al fallback global. */
export function estimarPesoPorCategoria(categoriaML: string | undefined): PesoEstimado {
  const id = (categoriaML ?? '').toUpperCase();
  const match =
    PESOS_POR_CATEGORIA.find((c) => c.prefijoCategoriaML !== '*' && id.startsWith(c.prefijoCategoriaML)) ??
    PESOS_POR_CATEGORIA[PESOS_POR_CATEGORIA.length - 1]!;
  return { gramos: match.gramos, etiqueta: match.etiqueta, esEstimado: true };
}
