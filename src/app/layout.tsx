import type { Metadata, Viewport } from 'next';
import { siteUrl } from '@/lib/site';
import './globals.css';

const DESCRIPCION =
  'Pegá un link de Mercado Libre Uruguay y te decimos si conviene comprarlo acá o traerlo del exterior, con courier e impuestos ya calculados.';

export const metadata: Metadata = {
  // Hace absolutas las URLs de OpenGraph al compartir el link.
  metadataBase: new URL(siteUrl()),
  title: {
    default: '¿Conviene afuera? — Comparador de precios Uruguay vs exterior',
    template: '%s · ¿Conviene afuera?',
  },
  description: DESCRIPCION,
  applicationName: '¿Conviene afuera?',
  keywords: [
    'comprar en el exterior',
    'franquicia Uruguay',
    'courier Uruguay',
    'Mercado Libre Uruguay',
    'impuestos importación',
  ],
  openGraph: {
    title: '¿Conviene afuera?',
    description: DESCRIPCION,
    locale: 'es_UY',
    type: 'website',
  },
  twitter: { card: 'summary', title: '¿Conviene afuera?', description: DESCRIPCION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1114' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
