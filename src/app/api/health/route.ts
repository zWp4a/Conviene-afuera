/**
 * GET /api/health
 * ================
 * Qué está configurado y qué no, sin revelar ningún valor. Sirve para
 * confirmar después de un deploy que las variables llegaron bien.
 */
import { NextResponse } from 'next/server';
import { ADUANA_UY } from '@config/aduana-uy';
import { HAY_TARIFAS_SIN_VERIFICAR } from '@config/couriers-uy';
import { env } from '@/lib/env';
import { activeProviders } from '@/modules/foreign-search';
import { hayCredenciales } from '@/modules/ml-reader';

export const dynamic = 'force-dynamic';

export function GET() {
  const e = env();
  return NextResponse.json({
    ok: true,
    mercadoLibre: hayCredenciales() ? 'configurado' : 'sin credenciales (usa datos mock)',
    matcher: e.ANTHROPIC_API_KEY ? `Claude (${e.MATCHER_MODEL})` : 'sólo determinístico',
    providersExterior: activeProviders().map((p) => p.id),
    cotizacion: e.FX_ENABLE_BCU ? 'BCU, respaldo dolarapi' : 'dolarapi, respaldo manual',
    normativa: {
      norma: ADUANA_UY.norma,
      vigenciaDesde: ADUANA_UY.vigenciaDesde,
      verificada: ADUANA_UY.verificadoContraFuenteOficial,
      revisadaEl: ADUANA_UY.revisadoEl,
    },
    tarifasCourierSinVerificar: HAY_TARIFAS_SIN_VERIFICAR,
  });
}
