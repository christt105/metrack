/** The enforced policy of the public pages (`/u/*` and `/privacy`): inline styles and the giscus comments script and frame. */
export const PUBLIC_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://giscus.app",
  "style-src 'self' 'unsafe-inline' https://giscus.app",
  "img-src 'self' data: blob: https://image.tmdb.org https://images.igdb.com https://steamcdn-a.akamaihd.net https://*.steamstatic.com https://www.themoviedb.org",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  'frame-src https://giscus.app',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
