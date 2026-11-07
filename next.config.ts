import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad. La app no recibe datos sensibles —no hay login ni
 * pagos— pero sí hace fetch a APIs externas desde el servidor y muestra
 * contenido que viene de terceros, así que conviene cerrar lo evidente.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  // No hace falta anunciar con qué está hecho.
  poweredByHeader: false,
  images: {
    // Imágenes de productos de Mercado Libre.
    remotePatterns: [
      { protocol: 'https', hostname: 'http2.mlstatic.com' },
      { protocol: 'https', hostname: 'mla-s1-p.mlstatic.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
