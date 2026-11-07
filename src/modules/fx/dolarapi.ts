/**
 * PROVIDER: dolarapi.com
 * =======================
 * API pública y gratuita, sin key. Devuelve compra y venta.
 *
 * Usamos la VENTA a propósito: es lo que te cuesta conseguir un dólar, y el
 * usuario de esta app está por gastar dólares en el exterior. Tomar la compra
 * daría un total en pesos artificialmente bajo y le estaríamos prometiendo un
 * ahorro que no va a ver en el resumen de la tarjeta.
 *
 * Ojo: esta fuente a veces sirve datos de varias semanas atrás sin avisar.
 * Por eso `index.ts` calcula siempre la antigüedad y la UI la muestra.
 */
import { z } from 'zod';
import type { FxProvider } from './types';

const schema = z.object({
  moneda: z.string(),
  compra: z.number().positive(),
  venta: z.number().positive(),
  fechaActualizacion: z.string(),
});

export const DOLARAPI_URL = 'https://uy.dolarapi.com/v1/cotizaciones/usd';

export class DolarApiProvider implements FxProvider {
  readonly id = 'dolarapi' as const;

  async fetchCotizacion(signal: AbortSignal): Promise<{ usdToUyu: number; fecha: string }> {
    const res = await fetch(DOLARAPI_URL, {
      signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`);

    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) throw new Error(`dolarapi devolvió un formato inesperado`);

    return {
      usdToUyu: parsed.data.venta,
      fecha: parsed.data.fechaActualizacion,
    };
  }
}
