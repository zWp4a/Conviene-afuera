import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // El endpoint JSON no tiene nada que indexar y cada llamada
      // consume el rate limit.
      disallow: '/api/',
    },
  };
}
