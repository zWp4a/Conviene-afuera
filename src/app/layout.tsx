import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '¿Conviene afuera?',
  description:
    'Pegá un link de Mercado Libre Uruguay y te decimos si conviene comprarlo acá o traerlo del exterior, con impuestos y courier incluidos.',
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
