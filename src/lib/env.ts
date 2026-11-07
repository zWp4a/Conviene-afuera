/**
 * VARIABLES DE ENTORNO
 * =====================
 * Único lugar donde se leen. Todas son server-only: ninguna lleva el prefijo
 * NEXT_PUBLIC_, así que ninguna key puede filtrarse al cliente.
 *
 * En la Fase 1 todas son opcionales: la app corre entera con mocks.
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Provider de búsqueda en el exterior. En la Fase 1: 'mock'. */
  FOREIGN_SEARCH_PROVIDERS: z.string().default('mock'),

  // --- Mercado Libre (Fase 2) ---
  ML_CLIENT_ID: z.string().optional(),
  ML_CLIENT_SECRET: z.string().optional(),

  // --- eBay (Fase 3) ---
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),

  // --- Amazon (desactivado en el MVP) ---
  AMAZON_PROVIDER: z.enum(['off', 'serpapi', 'rainforest', 'paapi']).default('off'),
  SERPAPI_KEY: z.string().optional(),
  RAINFOREST_KEY: z.string().optional(),

  // --- Claude (Fase 3: matcher) ---
  ANTHROPIC_API_KEY: z.string().optional(),
  MATCHER_MODEL: z.string().default('claude-haiku-5-5'),

  // --- Cotización ---
  FX_FALLBACK_USD_UYU: z.coerce.number().positive().default(40.5),
  /**
   * El BCU rechaza las IPs de datacenter con 403. Prendelo sólo si desplegás
   * en una infraestructura cuya IP acepte. Ver src/modules/fx/bcu.ts.
   */
  FX_ENABLE_BCU: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // --- Rate limiting ---
  RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(20),
});

export type Env = z.infer<typeof schema>;

let cachedEnv: Env | undefined;

export function env(): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`,
    );
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Sólo para tests. */
export function resetEnv(): void {
  cachedEnv = undefined;
}
