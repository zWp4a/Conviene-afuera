export type FxSource = 'bcu' | 'dolarapi' | 'fallback';

export interface Cotizacion {
  /** Cuántos pesos uruguayos vale un dólar. */
  readonly usdToUyu: number;
  readonly source: FxSource;
  /** Fecha de la cotización según la fuente (ISO). */
  readonly fecha: string;
  /** `true` si es el valor de respaldo y no una cotización real. */
  readonly esFallback: boolean;
  /**
   * Días transcurridos desde `fecha`. Las fuentes públicas a veces sirven
   * datos viejos sin avisar, así que esto se calcula siempre y la UI lo usa.
   */
  readonly antiguedadDias: number;
  /** `true` si el dato es más viejo que `MAX_ANTIGUEDAD_DIAS`. */
  readonly desactualizada: boolean;
}

/**
 * A partir de acá consideramos la cotización vieja. El BCU publica todos los
 * días hábiles, así que con un fin de semana largo de por medio tres días es
 * normal y cuatro ya es sospechoso.
 */
export const MAX_ANTIGUEDAD_DIAS = 4;

export interface FxProvider {
  readonly id: FxSource;
  fetchCotizacion(signal: AbortSignal): Promise<{ usdToUyu: number; fecha: string }>;
}
