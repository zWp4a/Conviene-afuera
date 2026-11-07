import { format } from '@/lib/money';
import type { Veredicto } from '@/modules/advisor';

const ESTILOS = {
  'conviene-afuera': { card: 'border-good-500 bg-good-50', texto: 'text-good-600', emoji: '✈️' },
  'conviene-aca': { card: 'border-brand-500 bg-brand-50', texto: 'text-brand-700', emoji: '🇺🇾' },
  empate: { card: 'border-warn-500 bg-warn-50', texto: 'text-warn-500', emoji: '🤔' },
  'sin-opciones': { card: 'border-warn-500 bg-warn-50', texto: 'text-warn-500', emoji: '🔍' },
} as const;

export function Verdict({ veredicto }: { veredicto: Veredicto }) {
  const s = ESTILOS[veredicto.id];

  return (
    <section
      className={`rounded-2xl border-2 p-5 sm:p-6 ${s.card}`}
      aria-labelledby="veredicto-titulo"
    >
      <p className="text-3xl leading-none" aria-hidden>
        {s.emoji}
      </p>
      <h2
        id="veredicto-titulo"
        className={`mt-3 text-xl font-bold leading-tight text-balance sm:text-2xl ${s.texto}`}
      >
        {veredicto.titular}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700 sm:text-base">
        {veredicto.detalle}
      </p>

      {veredicto.ahorroPct !== undefined && veredicto.ahorroUyu && (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/10 pt-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-600">
              Precio en Mercado Libre
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
              {format(veredicto.precioMlUyu)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-600">
              Puesto en Uruguay
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
              {veredicto.mejorOpcion ? format(veredicto.mejorOpcion.totalUyu) : '—'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-600">
              Diferencia
            </dt>
            <dd className={`mt-0.5 text-lg font-bold tabular-nums ${s.texto}`}>
              {veredicto.ahorroPct > 0 ? '−' : '+'}
              {format({ cents: Math.abs(veredicto.ahorroUyu.cents), currency: 'UYU' }).replace(
                /^[^\d]*/,
                '$ ',
              )}{' '}
              ({Math.abs(veredicto.ahorroPct)}%)
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
