/**
 * CACHÉ CON TTL DETRÁS DE UNA INTERFAZ
 * =====================================
 * MVP: en memoria. Si después hace falta SQLite o Redis, se implementa
 * `CacheStore` y se cambia `defaultCache`. Nada más se toca.
 */

export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCache implements CacheStore {
  private readonly store = new Map<string, Entry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    // Desalojo simple: si está lleno, saca la entrada más vieja en inserción.
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export const TTL = {
  /** Productos de ML y búsquedas del exterior: 24 h, como pide el brief. */
  BUSQUEDA_MS: 24 * 60 * 60 * 1000,
  /** Cotización del dólar: 1 día (el BCU publica una vez por día hábil). */
  COTIZACION_MS: 24 * 60 * 60 * 1000,
  /** Veredictos del matcher: 7 días (un match no cambia si no cambia el título). */
  MATCH_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * En dev, Next recarga los módulos y perderíamos la caché en cada cambio.
 * La guardamos en `globalThis` para que sobreviva al hot reload.
 */
const globalForCache = globalThis as unknown as { __convieneCache?: MemoryCache };

export const defaultCache: CacheStore = globalForCache.__convieneCache ?? new MemoryCache();
if (process.env.NODE_ENV !== 'production') globalForCache.__convieneCache = defaultCache as MemoryCache;

/** Envuelve una función async con caché por clave. */
export async function cached<T>(
  store: CacheStore,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = await store.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  await store.set(key, value, ttlMs);
  return value;
}
