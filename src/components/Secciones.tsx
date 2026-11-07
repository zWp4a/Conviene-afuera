import { ADUANA_UY, DISCLAIMER, FUENTES } from '@config/aduana-uy';

const PASOS = [
  {
    n: 1,
    titulo: 'Pegás el link',
    texto:
      'Copiás la dirección de la página del producto en Mercado Libre Uruguay y la pegás acá arriba.',
  },
  {
    n: 2,
    titulo: 'Buscamos el mismo producto afuera',
    texto:
      'No uno parecido: el mismo. Comparamos código de barras, modelo, capacidad y variante antes de decir que dos cosas son iguales.',
  },
  {
    n: 3,
    titulo: 'Calculamos el costo puesto en Uruguay',
    texto:
      'Producto, envío de la tienda, courier e impuestos según el régimen que te convenga. El número final, no el de la vidriera.',
  },
];

export function ComoFunciona() {
  return (
    <section aria-labelledby="como-titulo" className="mt-12">
      <h2 id="como-titulo" className="px-1 text-lg font-bold sm:text-xl">
        Cómo funciona
      </h2>
      <ol className="mt-4 space-y-3">
        {PASOS.map((p) => (
          <li key={p.n} className="surface flex gap-3 rounded-2xl p-4">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white"
            >
              {p.n}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-snug sm:text-base">{p.titulo}</h3>
              <p className="muted mt-1 text-sm leading-relaxed">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const CALCULO = [
  { k: 'Producto', v: 'Lo que sale en la tienda del exterior.' },
  { k: 'Envío de la tienda', v: 'Lo que cobra el vendedor hasta el warehouse de Miami.' },
  { k: 'Courier', v: 'Por tramo de peso, con el mínimo facturable que cobran de verdad.' },
  {
    k: 'Impuestos',
    v: `Franquicia (${ADUANA_UY.franquicia.enviosPorAnioCalendario} envíos al año, USD ${ADUANA_UY.franquicia.cupoAnualUsd} de cupo, IVA ${ADUANA_UY.franquicia.ivaTasa * 100}%) o prestación única (${ADUANA_UY.simplificado.tasa * 100}%, mínimo USD ${ADUANA_UY.simplificado.minimoUsd}). Mostramos los dos y recomendamos el más barato.`,
  },
];

export function QueCalculamos() {
  return (
    <section aria-labelledby="calc-titulo" className="mt-10">
      <h2 id="calc-titulo" className="px-1 text-lg font-bold sm:text-xl">
        Qué entra en la cuenta
      </h2>
      <dl className="surface mt-4 divide-y rounded-2xl" style={{ borderColor: 'var(--border)' }}>
        {CALCULO.map((c) => (
          <div key={c.k} className="p-4" style={{ borderColor: 'var(--border)' }}>
            <dt className="text-sm font-semibold">{c.k}</dt>
            <dd className="muted mt-0.5 text-sm leading-relaxed">{c.v}</dd>
          </div>
        ))}
      </dl>
      <p className="muted mt-3 px-1 text-xs leading-relaxed">
        Normativa aplicada: {ADUANA_UY.norma}, vigente desde {ADUANA_UY.vigenciaDesde}, reglamentando
        la {ADUANA_UY.leyHabilitante}.{' '}
        {ADUANA_UY.verificadoContraFuenteOficial && (
          <span className="font-medium text-good-600">
            Verificada contra fuente oficial el {ADUANA_UY.revisadoEl}.
          </span>
        )}
      </p>
    </section>
  );
}

const LIMITES = [
  {
    t: 'No comparamos productos distintos',
    d: 'Si afuera sólo hay una variante de otra capacidad o de otro año, te lo decimos y no inventamos un ahorro. Preferimos no responder antes que responder mal.',
  },
  {
    t: 'A veces te pedimos el precio',
    d: 'Mercado Libre cerró el acceso a los precios de sus publicaciones para aplicaciones no certificadas. Cuando no podemos verlo, te lo pedimos: lo tenés en la pantalla de la que copiaste el link.',
  },
  {
    t: 'Las tarifas de courier son de referencia',
    d: 'Varían por courier, por promoción y por temporada. Confirmá con el tuyo antes de comprar.',
  },
  {
    t: 'No es asesoramiento aduanero',
    d: 'Es una estimación para decidir. La palabra final la tiene Aduanas.',
  },
];

export function Limites() {
  return (
    <section aria-labelledby="limites-titulo" className="mt-10">
      <h2 id="limites-titulo" className="px-1 text-lg font-bold sm:text-xl">
        Lo que esta app no hace
      </h2>
      <p className="muted mt-1 px-1 text-sm leading-relaxed">
        Preferimos decirlo de entrada.
      </p>
      <ul className="mt-4 space-y-3">
        {LIMITES.map((l) => (
          <li key={l.t} className="surface rounded-2xl p-4">
            <h3 className="text-sm font-semibold">{l.t}</h3>
            <p className="muted mt-1 text-sm leading-relaxed">{l.d}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
      <p className="px-1 text-xs font-medium leading-relaxed">{DISCLAIMER}</p>
      <p className="muted mt-3 px-1 text-xs leading-relaxed">
        Fuentes de la normativa:{' '}
        {FUENTES.filter((f) => f.tipo === 'oficial').map((f, i, arr) => (
          <span key={f.url}>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {f.nombre}
            </a>
            {i < arr.length - 1 ? ' · ' : ''}
          </span>
        ))}
      </p>
      <p className="muted mt-3 px-1 pb-8 text-xs">
        Hecho en Uruguay. No tenemos relación con Mercado Libre ni con ningún courier.
      </p>
    </footer>
  );
}
