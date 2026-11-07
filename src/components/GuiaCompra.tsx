import type { PasoGuia } from '@/modules/advisor';

export function GuiaCompra({ pasos }: { pasos: readonly PasoGuia[] }) {
  if (pasos.length === 0) return null;
  return (
    <section className="surface rounded-2xl p-4 sm:p-5" aria-labelledby="guia-titulo">
      <h2 id="guia-titulo" className="text-base font-bold sm:text-lg">
        Cómo traerlo
      </h2>
      <ol className="mt-3 space-y-4">
        {pasos.map((paso, i) => (
          <li key={paso.titulo} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-snug">{paso.titulo}</h3>
              <p className="muted mt-0.5 text-sm leading-relaxed">{paso.detalle}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Perdidas({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="surface rounded-2xl p-4 sm:p-5" aria-labelledby="perdidas-titulo">
      <h2 id="perdidas-titulo" className="text-base font-bold sm:text-lg">
        Lo que perdés comprando afuera
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="muted flex gap-2 text-sm leading-relaxed">
            <span aria-hidden className="shrink-0 text-bad-500">
              −
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
