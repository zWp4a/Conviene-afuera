import { format } from '@/lib/money';
import { uyuToUsd, usdToUyu, type Cotizacion } from '@/modules/fx';
import type { MLProduct } from '@/modules/ml-reader';

export function ProductCard({ ml, fx }: { ml: MLProduct; fx: Cotizacion }) {
  const enUyu = usdToUyu(ml.price, fx);
  const enUsd = uyuToUsd(ml.price, fx);

  return (
    <section className="surface rounded-2xl p-4 sm:p-5" aria-labelledby="ml-titulo">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Mercado Libre Uruguay
        </p>
        {ml.source === 'mock' && (
          <span className="shrink-0 rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn-500">
            datos de ejemplo
          </span>
        )}
      </div>

      <h2 id="ml-titulo" className="mt-2 text-base font-semibold leading-snug sm:text-lg">
        {ml.title}
      </h2>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-bold tabular-nums">{format(enUyu)}</span>
        <span className="muted text-sm tabular-nums">{format(enUsd)}</span>
      </p>

      <dl className="muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {ml.attributes.brand && (
          <div className="flex gap-1">
            <dt>Marca:</dt>
            <dd className="font-medium">{ml.attributes.brand}</dd>
          </div>
        )}
        {ml.attributes.model && (
          <div className="flex gap-1">
            <dt>Modelo:</dt>
            <dd className="font-medium">{ml.attributes.model}</dd>
          </div>
        )}
        {ml.attributes.capacity && (
          <div className="flex gap-1">
            <dt>Capacidad:</dt>
            <dd className="font-medium">{ml.attributes.capacity}</dd>
          </div>
        )}
        {ml.shipping.envioGratis && <div>Envío gratis{ml.shipping.esFull ? ' · Full' : ''}</div>}
        {ml.seller.esTiendaOficial && <div className="font-medium">Tienda oficial</div>}
      </dl>

      <a
        href={ml.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs font-medium text-brand-600 underline underline-offset-2"
      >
        Ver en Mercado Libre
      </a>
    </section>
  );
}
