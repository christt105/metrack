/**
 * The report-only policy of the single-page app and everything that is not a public page. The inline style hash is
 * the hidden element Cloudflare's JavaScript Detections injects into HTML; the app has no `'unsafe-inline'`.
 */
export const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-hashes' 'sha256-Ia8f7Xd1GU9rNhtqyt5pM4QjRB9pqCkMhfAkkeE4+l4='",
  "img-src 'self' data: blob: https://image.tmdb.org https://images.igdb.com https://steamcdn-a.akamaihd.net https://*.steamstatic.com https://*.steamgriddb.com https://covers.openlibrary.org https://archive.org https://*.us.archive.org https://artworks.thetvdb.com",
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
