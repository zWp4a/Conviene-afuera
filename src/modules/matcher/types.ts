export type MatchMethod = 'gtin' | 'model' | 'descarte' | 'llm' | 'sin-datos';

/** Cómo se le presenta el resultado al usuario. */
export type MatchTier = 'exacto' | 'verificar' | 'similar';

export interface MatchVerdict {
  readonly match: boolean;
  /** 0 a 1. */
  readonly confidence: number;
  /** Por qué. Debe nombrar un atributo concreto, no ser genérico. */
  readonly reason: string;
  readonly method: MatchMethod;
  readonly tier: MatchTier;
}

/**
 * Umbrales ASIMÉTRICOS, y la asimetría es deliberada.
 *
 * El error caro no es decir "no son iguales" cuando sí lo son — eso sólo
 * pierde una oportunidad. El error caro es lo contrario: mostrar un iPhone de
 * 128 GB de afuera contra uno de 256 GB de acá y prometer un ahorro que no
 * existe. Eso destruye la credibilidad del producto, así que el umbral de
 * "exacto" es alto y hay una banda intermedia explícita.
 */
export const UMBRALES = {
  /** ≥ esto: se muestra como el mismo producto. */
  EXACTO: 0.9,
  /** ≥ esto y < EXACTO: "probablemente el mismo, verificá la variante". */
  VERIFICAR: 0.75,
} as const;

export function tierFor(confidence: number, match: boolean): MatchTier {
  if (!match) return 'similar';
  if (confidence >= UMBRALES.EXACTO) return 'exacto';
  if (confidence >= UMBRALES.VERIFICAR) return 'verificar';
  return 'similar';
}

/** Lo que el matcher necesita saber de cada lado. */
export interface MatchCandidate {
  readonly title: string;
  readonly brand?: string;
  readonly model?: string;
  readonly gtin?: string;
  readonly capacity?: string;
}
