import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    // Imágenes de productos de Mercado Libre.
    remotePatterns: [
      { protocol: 'https', hostname: 'http2.mlstatic.com' },
      { protocol: 'https', hostname: 'mla-s1-p.mlstatic.com' },
    ],
  },
};

export default config;
