/**
 * LOGGING DE CONSULTAS
 * =====================
 * El brief pide registrar cada consulta (link, productos encontrados, match,
 * veredicto) para poder auditar la calidad del matching. Eso es lo que hace
 * este módulo, y es la única razón por la que existe.
 *
 * MVP: líneas JSON a stdout + un buffer en memoria para inspeccionar en dev.
 * No hay base de datos todavía (fuera de alcance del MVP).
 */

export interface ConsultaLog {
  readonly ts: string;
  readonly requestId: string;
  /** Link de ML que pegó el usuario. */
  readonly mlUrl: string;
  readonly mlTitulo?: string;
  readonly mlPrecioUsd?: number;
  /** Cuántas ofertas devolvieron los providers del exterior. */
  readonly ofertasEncontradas: number;
  /** Veredictos del matcher, para auditar calidad. */
  readonly matches: readonly {
    readonly providerId: string;
    readonly titulo: string;
    readonly match: boolean;
    readonly confidence: number;
    readonly method: string;
    readonly reason: string;
  }[];
  /** Veredicto final del advisor. */
  readonly veredicto?: string;
  readonly ahorroUyu?: number;
  readonly durationMs: number;
  readonly error?: string;
}

const MAX_BUFFER = 200;
const globalForLog = globalThis as unknown as { __convieneLogs?: ConsultaLog[] };
const buffer: ConsultaLog[] = globalForLog.__convieneLogs ?? [];
if (process.env.NODE_ENV !== 'production') globalForLog.__convieneLogs = buffer;

export function logConsulta(entry: ConsultaLog): void {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  // Una línea JSON por consulta: fácil de grepear o mandar a un colector.
  console.log(JSON.stringify({ evt: 'consulta', ...entry }));
}

/** Últimas consultas, para revisar la calidad del matching en dev. */
export function recentConsultas(): readonly ConsultaLog[] {
  return [...buffer].reverse();
}

export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}
