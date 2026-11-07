/**
 * PROVIDER: Banco Central del Uruguay — DESACTIVADO POR DEFECTO
 * ==============================================================
 * El BCU es la fuente oficial, pero su servidor rechaza con 403 las
 * peticiones que vienen de IPs de datacenter:
 *
 *   HTTP/1.1 403 Forbidden
 *   Server: Oracle-iPlanet-Web-Server/7.0
 *   "Your client is not allowed to access the requested object."
 *
 * Verificado el 2026-11-07 desde este entorno. No lo intentamos eludir.
 *
 * Si desplegás en una infraestructura cuya IP el BCU sí acepta, prendelo con
 * FX_ENABLE_BCU=true: pasa a ser la fuente primaria y dolarapi queda de
 * respaldo. El servicio es SOAP, en
 * https://cotizaciones.bcu.gub.uy/wsbcucotizaciones/awsbcucotizaciones.asmx
 * y la operación relevante es `Cotizacion` con la moneda 2225 (dólar USA).
 */
import type { FxProvider } from './types';

export class BcuProvider implements FxProvider {
  readonly id = 'bcu' as const;

  async fetchCotizacion(_signal: AbortSignal): Promise<{ usdToUyu: number; fecha: string }> {
    throw new Error(
      'El provider del BCU no está implementado: su servidor rechaza las IPs de datacenter. Ver src/modules/fx/bcu.ts.',
    );
  }
}
