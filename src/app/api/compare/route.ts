/**
 * POST /api/compare
 * ==================
 * Endpoint JSON con rate limiting. La UI usa el server action; esto existe
 * para integraciones y para la extensión de navegador de la v2.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { compare } from '@/modules/compare';
import { MLReaderError } from '@/modules/ml-reader';

const bodySchema = z.object({
  url: z.string().min(1),
  franquicia: z
    .object({
      enviosUsados: z.number().int().min(0).max(3),
      cupoUsadoUsd: z.number().min(0).max(800),
    })
    .optional(),
});

export async function POST(request: Request) {
  const rl = rateLimit(clientKey(request.headers), {
    limit: env().RATE_LIMIT_PER_HOUR,
    windowMs: 60 * 60 * 1000,
  });

  const rlHeaders = {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limit', message: 'Demasiadas consultas. Esperá un rato.' },
      {
        status: 429,
        headers: {
          ...rlHeaders,
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'bad_request', message: 'El body tiene que ser JSON.' },
      { status: 400, headers: rlHeaders },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'bad_request', message: z.prettifyError(parsed.error) },
      { status: 400, headers: rlHeaders },
    );
  }

  try {
    const result = await compare({
      url: parsed.data.url,
      ...(parsed.data.franquicia
        ? { franquicia: { ...parsed.data.franquicia, asumido: false } }
        : {}),
    });
    return NextResponse.json(result, { headers: rlHeaders });
  } catch (error) {
    if (error instanceof MLReaderError) {
      return NextResponse.json(
        { error: error.code, message: error.userMessage },
        { status: 400, headers: rlHeaders },
      );
    }
    console.error('POST /api/compare falló', error);
    return NextResponse.json(
      { error: 'internal', message: 'Error interno.' },
      { status: 500, headers: rlHeaders },
    );
  }
}
