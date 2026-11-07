import { ADUANA_UY, FUENTE_OFICIAL_URL } from '@config/aduana-uy';
import { describirCotizacion } from '@/modules/fx';
import type { CompareResult } from '@/modules/compare';
import { GuiaCompra, Perdidas } from './GuiaCompra';
import { OptionRow } from './OptionRow';
import { ProductCard } from './ProductCard';
import { Verdict } from './Verdict';

export function Resultado({ result }: { result: CompareResult }) {
  const { ml, fx, opciones, veredicto } = result;
  const mejorId = veredicto.mejorOpcion?.offer.externalId;

  const confiables = opciones.filter((o) => o.match.tier !== 'similar');
  const similares = opciones.filter((o) => o.match.tier === 'similar');

  return (
    <div className="mt-4 space-y-4">
      <Verdict veredicto={veredicto} />
      <ProductCard ml={ml} fx={fx} />

      {confiables.length > 0 && (
        <section aria-labelledby="opciones-titulo">
          <h2 id="opciones-titulo" className="px-1 text-base font-bold sm:text-lg">
            Opciones del exterior
          </h2>
          <ul className="mt-2 space-y-3">
            {confiables.map((o) => (
              <OptionRow
                key={`${o.offer.providerId}-${o.offer.externalId}`}
                opcion={o}
                destacada={o.offer.externalId === mejorId}
              />
            ))}
          </ul>
        </section>
      )}

      <GuiaCompra pasos={veredicto.guia} />
      <Perdidas items={veredicto.perdidas} />

      {similares.length > 0 && (
        <details className="surface rounded-2xl p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Productos similares (no idénticos) · {similares.length}
          </summary>
          <p className="muted mt-1.5 text-xs leading-relaxed">
            Estos NO son el mismo producto, así que no los comparamos por precio. Los mostramos
            sólo para que veas qué más hay.
          </p>
          <ul className="mt-3 space-y-3">
            {similares.map((o) => (
              <OptionRow
                key={`${o.offer.providerId}-${o.offer.externalId}`}
                opcion={o}
                destacada={false}
              />
            ))}
          </ul>
        </details>
      )}

      <footer className="muted space-y-2 px-1 pb-8 text-xs leading-relaxed">
        <p className="font-medium">{veredicto.disclaimer}</p>
        <p>
          Normativa aplicada: {ADUANA_UY.norma}, vigente desde {ADUANA_UY.vigenciaDesde}.{' '}
          {!ADUANA_UY.verificadoContraFuenteOficial && (
            <strong className="text-warn-500">
              Los parámetros no están verificados contra fuente oficial.
            </strong>
          )}{' '}
          <a
            href={FUENTE_OFICIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            aduanas.gub.uy
          </a>
        </p>
        <p className={fx.desactualizada ? 'text-warn-500' : undefined}>
          {fx.desactualizada && '⚠ '}
          Cotización usada: {describirCotizacion(fx)}
        </p>
        {veredicto.mejorOpcion?.costo.franquicia.consumeFranquicia &&
          veredicto.id === 'conviene-afuera' && (
            <p>
              Si lo traés por franquicia, te consume 1 de los{' '}
              {ADUANA_UY.franquicia.enviosPorAnioCalendario} envíos del año y USD{' '}
              {veredicto.mejorOpcion.costo.franquicia.consumeFranquicia.cupoUsd.toFixed(2)} de los
              USD {ADUANA_UY.franquicia.cupoAnualUsd} de cupo anual.
            </p>
          )}
        {result.erroresProviders.length > 0 && (
          <p className="text-warn-500">
            Algunas tiendas no respondieron:{' '}
            {result.erroresProviders.map((e) => e.providerId).join(', ')}.
          </p>
        )}
      </footer>
    </div>
  );
}
