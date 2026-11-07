import { SearchForm } from '@/components/SearchForm';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Conviene afuera?</h1>
        <p className="muted mt-2 text-sm leading-relaxed sm:text-base">
          Pegá el link de un producto de Mercado Libre Uruguay y te decimos si conviene comprarlo
          acá o traerlo del exterior, con impuestos y courier ya calculados.
        </p>
      </header>

      <div className="mt-6">
        <SearchForm />
      </div>
    </main>
  );
}
