/** The report-only policy of the single-page app and everything that is not a public page. `apps/web/public/_headers` lists the same string. */
export const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://image.tmdb.org https://images.igdb.com https://steamcdn-a.akamaihd.net https://*.steamstatic.com https://*.steamgriddb.com https://covers.openlibrary.org https://artworks.thetvdb.com",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
