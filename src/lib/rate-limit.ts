/**
 * RATE LIMITING BÁSICO (sliding window en memoria)
 * =================================================
 * Suficiente para el MVP en una sola instancia. En Vercel con varias
 * instancias cada una lleva su propia cuenta, así que el límite efectivo es
 * más laxo: para algo serio hay que mover esto a Redis/Upstash.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Epoch ms en que se libera un slot. */
  readonly resetAt: number;
  readonly limit: number;
}

export interface RateLimitOptions {
  readonly limit: number;
  readonly windowMs: number;
}

export const DEFAULT_LIMIT: RateLimitOptions = {
  limit: 20,
  windowMs: 60 * 60 * 1000, // 20 consultas por hora por IP
};

const globalForRl = globalThis as unknown as { __convieneRl?: Map<string, number[]> };
const hits: Map<string, number[]> = globalForRl.__convieneRl ?? new Map();
if (process.env.NODE_ENV !== 'production') globalForRl.__convieneRl = hits;

export function rateLimit(key: string, opts: RateLimitOptions = DEFAULT_LIMIT): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const prev = hits.get(key) ?? [];
  const recent = prev.filter((t) => t > windowStart);

  if (recent.length >= opts.limit) {
    hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldest + opts.windowMs,
      limit: opts.limit,
    };
  }

  recent.push(now);
  hits.set(key, recent);

  // Limpieza oportunista para que el Map no crezca sin techo.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    }
  }

  return {
    allowed: true,
    remaining: opts.limit - recent.length,
    resetAt: now + opts.windowMs,
    limit: opts.limit,
  };
}

/** Clave de rate limit a partir de los headers de la request. */
export function clientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'desconocida';
  return `ip:${ip}`;
}

/** Sólo para tests. */
export function resetRateLimit(): void {
  hits.clear();
}
