'use client';

import { useActionState, useState } from 'react';
import { compareAction, type CompareState } from '@/app/actions';
import { isMLUrl } from '@/modules/ml-reader/parse-url';
import { Resultado } from './Resultado';

const INICIAL: CompareState = { status: 'idle' };

export interface SearchFormProps {
  /**
   * Secciones de la portada. Se renderizan sólo mientras no hay resultado:
   * una vez que la persona tiene su respuesta, explicarle cómo funciona la
   * app es ruido, y el disclaimer del resultado ya cubre lo legal.
   */
  readonly landing?: React.ReactNode;
}

export function SearchForm({ landing }: SearchFormProps) {
  const [state, action, pending] = useActionState(compareAction, INICIAL);
  const [url, setUrl] = useState('');
  const [mostrarFranquicia, setMostrarFranquicia] = useState(false);

  // Mercado Libre cerró el acceso a los precios de publicaciones para apps no
  // certificadas, así que cuando no podemos verlo se lo pedimos a la persona.
  const pidePrecio = state.status === 'falta-precio';
  const hayResultado = state.status === 'ok';

  // Validación en vivo, sin molestar hasta que haya algo escrito.
  const urlSospechosa = url.trim().length > 12 && !isMLUrl(url);

  return (
    <>
      <form action={action} className="surface rounded-2xl p-4 sm:p-5">
        <label htmlFor="url" className="block text-sm font-semibold">
          Pegá el link de Mercado Libre
        </label>
        <input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://articulo.mercadolibre.com.uy/MLU-..."
          aria-invalid={urlSospechosa}
          aria-describedby={urlSospechosa ? 'url-aviso' : undefined}
          className="mt-2 w-full rounded-xl border px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          style={{ borderColor: urlSospechosa ? 'var(--color-warn-500)' : 'var(--border)' }}
        />
        {urlSospechosa && (
          <p id="url-aviso" className="mt-1.5 text-xs text-warn-500">
            Ese link no parece ser de un producto de mercadolibre.com.uy.
          </p>
        )}

        {pidePrecio && (
          <fieldset
            className="mt-3 rounded-xl border-2 border-warn-500 bg-warn-50 p-3"
            aria-describedby="precio-ayuda"
          >
            <legend className="px-1 text-xs font-semibold text-warn-500">
              Falta el precio
            </legend>
            <p id="precio-ayuda" className="text-xs leading-relaxed text-neutral-700">
              Identificamos el producto, pero Mercado Libre no nos deja ver su precio.
              Copialo de la pantalla de Mercado Libre y lo comparamos.
            </p>
            <div className="mt-2 flex gap-2">
              <select
                name="monedaMl"
                aria-label="Moneda"
                defaultValue="UYU"
                className="rounded-lg border bg-white px-2 py-2.5 text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="UYU">$ UYU</option>
                <option value="USD">US$</option>
              </select>
              <input
                name="precioMl"
                type="text"
                inputMode="decimal"
                required
                autoFocus
                placeholder="18500"
                aria-label="Precio en Mercado Libre"
                className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2.5 text-base tabular-nums"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          </fieldset>
        )}

        <button
          type="button"
          onClick={() => setMostrarFranquicia((v) => !v)}
          className="muted mt-3 text-xs font-medium underline underline-offset-2"
          aria-expanded={mostrarFranquicia}
        >
          {mostrarFranquicia ? 'Ocultar' : '¿Ya usaste franquicia este año?'}
        </button>

        {mostrarFranquicia && (
          <fieldset className="mt-3 grid grid-cols-2 gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <legend className="px-1 text-xs font-semibold">Tu franquicia este año</legend>
            <div>
              <label htmlFor="enviosUsados" className="muted block text-xs">
                Envíos usados (de 3)
              </label>
              <input
                id="enviosUsados"
                name="enviosUsados"
                type="number"
                min={0}
                max={3}
                defaultValue={0}
                className="mt-1 w-full rounded-lg border px-2 py-2 text-sm tabular-nums"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
            <div>
              <label htmlFor="cupoUsadoUsd" className="muted block text-xs">
                Cupo usado (USD, de 800)
              </label>
              <input
                id="cupoUsadoUsd"
                name="cupoUsadoUsd"
                type="number"
                min={0}
                max={800}
                step={1}
                defaultValue={0}
                className="mt-1 w-full rounded-lg border px-2 py-2 text-sm tabular-nums"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
            <p className="muted col-span-2 text-xs leading-relaxed">
              Si no lo completás, asumimos que tenés la franquicia entera disponible.
            </p>
          </fieldset>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-xl bg-brand-500 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Comparando…' : pidePrecio ? 'Comparar con ese precio' : '¿Conviene afuera?'}
        </button>
      </form>

      {pending && <Cargando />}

      {!pending && state.status === 'error' && (
        <div role="alert" className="mt-4 rounded-2xl border-2 border-bad-500 bg-bad-50 p-4">
          <p className="text-sm font-semibold text-bad-500">No pudimos comparar</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-700">{state.message}</p>
        </div>
      )}

      {!pending && state.status === 'ok' && <Resultado result={state.result} />}

      {!hayResultado && landing}
    </>
  );
}

function Cargando() {
  const pasos = [
    'Leyendo el producto en Mercado Libre…',
    'Buscando el mismo producto afuera…',
    'Calculando impuestos y courier…',
  ];
  return (
    <div className="mt-4 space-y-3" aria-live="polite" aria-busy="true">
      <div className="surface rounded-2xl p-4">
        <ul className="space-y-2">
          {pasos.map((p) => (
            <li key={p} className="muted flex items-center gap-2 text-sm">
              <span className="skeleton size-3 rounded-full" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="surface rounded-2xl p-4">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="skeleton mt-3 h-8 w-1/2 rounded" />
        <div className="skeleton mt-3 h-4 w-full rounded" />
      </div>
    </div>
  );
}
