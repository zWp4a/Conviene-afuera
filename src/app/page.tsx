import { ADUANA_UY } from '@config/aduana-uy';
import { SearchForm } from '@/components/SearchForm';
import { ComoFunciona, Limites, QueCalculamos, SiteFooter } from '@/components/Secciones';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="px-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-600">
          <svg viewBox="0 0 512 512" className="size-5 shrink-0" aria-hidden>
            <rect width="512" height="512" rx="112" fill="currentColor" />
            <g
              stroke="#fff"
              strokeWidth="30"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              <path d="M256 168 V 392" />
              <path d="M190 400 H 322" />
              <path d="M112 196 L 400 134" />
              <path d="M62 232 Q 112 296 162 232 Z" />
              <path d="M350 170 Q 400 234 450 170 Z" />
            </g>
          </svg>
          ¿Conviene afuera?
        </p>

        <h1 className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight text-balance sm:text-4xl">
          ¿Te conviene comprarlo acá o traerlo?
        </h1>
        <p className="muted mt-3 text-base leading-relaxed">
          Pegá el link de un producto de Mercado Libre Uruguay y te decimos cuánto sale el mismo
          producto puesto en tu casa, con courier e impuestos ya calculados.
        </p>
      </header>

      <div className="mt-6">
        <SearchForm
          landing={
            <>
              <ul className="muted mt-4 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs">
                <li>Gratis y sin registro</li>
                <li aria-hidden>·</li>
                <li>Normativa {ADUANA_UY.vigenciaDesde.slice(0, 4)} verificada</li>
                <li aria-hidden>·</li>
                <li>Los dos regímenes, siempre</li>
              </ul>
              <ComoFunciona />
              <QueCalculamos />
              <Limites />
              <SiteFooter />
            </>
          }
        />
      </div>
    </main>
  );
}
