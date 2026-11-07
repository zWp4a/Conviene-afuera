'use server';

import { headers } from 'next/headers';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { fromUnits, type Currency } from '@/lib/money';
import { MLReaderError } from '@/modules/ml-reader';
import { compare, type CompareResult } from '@/modules/compare';
import type { EstadoFranquicia } from '@/modules/landed-cost';

export type CompareState =
  | { status: 'idle' }
  | { status: 'ok'; result: CompareResult }
  | { status: 'error'; message: string; code?: string }
  /** Identificamos el producto pero falta el precio: lo pedimos en la UI. */
  | { status: 'falta-precio'; message: string; url: string };

export async function compareAction(
  _prev: CompareState,
  formData: FormData,
): Promise<CompareState> {
  const url = String(formData.get('url') ?? '').trim();

  // Rate limiting por IP, como pide el brief.
  const h = await headers();
  const rl = rateLimit(clientKey(h), {
    limit: env().RATE_LIMIT_PER_HOUR,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    const minutos = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 60_000));
    return {
      status: 'error',
      code: 'RATE_LIMIT',
      message: `Hiciste muchas consultas seguidas. Probá de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
    };
  }

  // Estado de franquicia, si el usuario lo respondió.
  const enviosRaw = formData.get('enviosUsados');
  const cupoRaw = formData.get('cupoUsadoUsd');
  const respondio = enviosRaw !== null && String(enviosRaw) !== '';

  const franquicia: EstadoFranquicia = respondio
    ? {
        enviosUsados: Math.max(0, Math.min(3, Number(enviosRaw) || 0)),
        cupoUsadoUsd: Math.max(0, Math.min(800, Number(cupoRaw) || 0)),
        asumido: false,
      }
    : { enviosUsados: 0, cupoUsadoUsd: 0, asumido: true };

  // Precio de Mercado Libre, cuando la persona lo escribe.
  const precioRaw = String(formData.get('precioMl') ?? '').replace(',', '.').trim();
  const monedaRaw = String(formData.get('monedaMl') ?? 'UYU');
  const precioNum = precioRaw === '' ? Number.NaN : Number(precioRaw);
  const precioManual =
    Number.isFinite(precioNum) && precioNum > 0
      ? fromUnits(precioNum, monedaRaw === 'USD' ? 'USD' : ('UYU' as Currency))
      : undefined;

  try {
    const result = await compare({
      url,
      franquicia,
      ...(precioManual ? { precioManual } : {}),
    });
    return { status: 'ok', result };
  } catch (error) {
    if (error instanceof MLReaderError) {
      if (error.code === 'PRECIO_NO_DISPONIBLE') {
        return { status: 'falta-precio', message: error.userMessage, url };
      }
      return { status: 'error', code: error.code, message: error.userMessage };
    }
    console.error('compareAction falló', error);
    return {
      status: 'error',
      message: 'Algo se rompió de nuestro lado. Probá de nuevo en un rato.',
    };
  }
}
