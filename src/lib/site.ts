/**
 * URL pública del sitio.
 *
 * En Vercel, VERCEL_PROJECT_PRODUCTION_URL trae el dominio de producción sin
 * protocolo. En local no existe, así que caemos a localhost.
 */
export function siteUrl(): string {
  const explicita = process.env.SITE_URL;
  if (explicita) return explicita.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
