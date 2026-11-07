/**
 * OAUTH DE MERCADO LIBRE
 * =======================
 * Verificado el 2026-11-07: la API rechaza con 403 (`PolicyAgent`) cualquier
 * llamada sin token, incluso a endpoints públicos como /sites/MLU. Hace falta
 * registrar una app en developers.mercadolibre.com.uy.
 *
 * Usamos el grant `client_credentials`, que no necesita que un usuario
 * autorice nada: alcanza con el App ID y el Secret. El token dura 6 horas;
 * lo cacheamos con un margen de seguridad y lo renovamos solo.
 */
import { z } from 'zod';
import { env } from '@/lib/env';
import { MLReaderError } from './types';

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
});

interface TokenCacheado {
  token: string;
  expiraEn: number;
}

/** Renovamos 5 minutos antes de que venza, para no cortar una request. */
const MARGEN_MS = 5 * 60 * 1000;

// En `globalThis` para que sobreviva al hot reload de Next en desarrollo.
const g = globalThis as unknown as { __mlToken?: TokenCacheado; __mlTokenInFlight?: Promise<string> };

export function hayCredenciales(): boolean {
  const e = env();
  return Boolean(e.ML_CLIENT_ID && e.ML_CLIENT_SECRET);
}

export function resetTokenCache(): void {
  delete g.__mlToken;
  delete g.__mlTokenInFlight;
}

async function pedirToken(): Promise<string> {
  const e = env();
  if (!e.ML_CLIENT_ID || !e.ML_CLIENT_SECRET) {
    throw new MLReaderError(
      'SIN_CREDENCIALES',
      'Falta configurar las credenciales de Mercado Libre.',
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: e.ML_CLIENT_ID,
      client_secret: e.ML_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new MLReaderError(
      'SIN_CREDENCIALES',
      'Mercado Libre rechazó las credenciales de la aplicación.',
      `${res.status} ${await res.text().catch(() => '')}`.slice(0, 300),
    );
  }

  const parsed = tokenSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new MLReaderError(
      'API_NO_DISPONIBLE',
      'Mercado Libre devolvió un token con un formato inesperado.',
    );
  }

  g.__mlToken = {
    token: parsed.data.access_token,
    expiraEn: Date.now() + parsed.data.expires_in * 1000 - MARGEN_MS,
  };
  return parsed.data.access_token;
}

/**
 * Token válido, del caché o nuevo. Si llegan varias requests juntas con el
 * token vencido, todas esperan la misma renovación en lugar de disparar una
 * cada una.
 */
export async function getAccessToken(): Promise<string> {
  const cacheado = g.__mlToken;
  if (cacheado && cacheado.expiraEn > Date.now()) return cacheado.token;

  if (!g.__mlTokenInFlight) {
    g.__mlTokenInFlight = pedirToken().finally(() => {
      delete g.__mlTokenInFlight;
    });
  }
  return g.__mlTokenInFlight;
}
