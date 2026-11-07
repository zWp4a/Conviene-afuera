import { format } from '@/lib/money';
import { TEXTO_WARNING } from '@/modules/landed-cost';
import type { OpcionExterior } from '@/modules/advisor';

const TIER = {
  exacto: { label: 'Mismo producto', clase: 'bg-good-50 text-good-600' },
  verificar: { label: 'Verificá la variante', clase: 'bg-warn-50 text-warn-500' },
  similar: { label: 'Similar, no idéntico', clase: 'bg-neutral-100 text-neutral-600' },
} as const;

export function OptionRow({ opcion, destacada }: { opcion: OpcionExterior; destacada: boolean }) {
  const b = opcion.costo.recomendado ?? opcion.costo.franquicia;
  const tier = TIER[opcion.match.tier];
  const otro =
    b.regime === 'franquicia' ? opcion.costo.simplificado : opcion.costo.franquicia;

  return (
    <li
      className={`surface rounded-2xl p-4 ${destacada ? 'ring-2 ring-good-500' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="muted text-xs font-semibold uppercase tracking-wide">
          {opcion.offer.merchantName ?? opcion.offer.providerId}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tier.clase}`}>
          {tier.label}
        </span>
      </div>

      <h3 className="mt-1.5 text-sm font-semibold leading-snug">{opcion.offer.title}</h3>
      <p className="muted mt-1 text-xs leading-relaxed">{opcion.match.reason}</p>

      {/* Desglose del costo. Mobile: lista; sm+: grilla. */}
      <dl className="mt-3 space-y-1 border-t pt-3 text-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-between gap-3">
          <dt className="muted">Producto</dt>
          <dd className="tabular-nums">{format(b.productUsd)}</dd>
        </div>
        {b.domesticShippingUsd.cents > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="muted">Envío en origen</dt>
            <dd className="tabular-nums">{format(b.domesticShippingUsd)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="muted">Courier ({b.courierNombre})</dt>
          <dd className="tabular-nums">{format(b.courierUsd)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="muted">
            Impuestos{' '}
            <span className="text-xs">
              ({b.regime === 'franquicia' ? 'franquicia' : 'simplificado'}
              {b.tasaEfectivaPct > 0 ? `, ${b.tasaEfectivaPct}% efectivo` : ', exento'})
            </span>
          </dt>
          <dd className="tabular-nums">{format(b.taxUsd)}</dd>
        </div>
        <div
          className="flex justify-between gap-3 border-t pt-2 font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          <dt>Total puesto en Uruguay</dt>
          <dd className="text-right tabular-nums">
            {format(b.totalUsd)}
            <span className="muted block text-xs font-normal">{format(opcion.totalUyu)}</span>
          </dd>
        </div>
      </dl>

      <p className="muted mt-2 text-xs">{b.explicacionImpuesto}</p>

      {/* El otro régimen, para que el usuario vea las dos opciones. */}
      <details className="mt-2 text-xs">
        <summary className="muted cursor-pointer font-medium">
          Ver el otro régimen ({otro.regime === 'franquicia' ? 'franquicia' : 'simplificado'})
        </summary>
        <div className="muted mt-1.5 leading-relaxed">
          {otro.applicable ? (
            <>
              Total {format(otro.totalUsd)} — {otro.explicacionImpuesto}
            </>
          ) : (
            <>No se puede usar: {otro.bloqueo?.message}</>
          )}
        </div>
      </details>

      {b.warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {b.warnings.map((w) => (
            <li key={w} className="text-xs leading-relaxed text-warn-500">
              ⚠ {TEXTO_WARNING[w]}
            </li>
          ))}
        </ul>
      )}

      <a
        href={opcion.offer.affiliateUrl ?? opcion.offer.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 inline-block text-xs font-medium text-brand-600 underline underline-offset-2"
      >
        Ver en la tienda
      </a>
    </li>
  );
}
