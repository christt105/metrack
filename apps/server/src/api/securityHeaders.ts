/** The headers every response carries, as `[name, value]` pairs. `apps/web/public/_headers` lists the same ones. */
export const SECURITY_HEADERS: readonly (readonly [string, string])[] = [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'DENY'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
];

/** Sent only over HTTPS; a browser ignores it on plain HTTP and it would pin a local setup. */
export const HSTS_HEADER: readonly [string, string] = [
  'Strict-Transport-Security',
  'max-age=31536000',
];

/** Whether a request reached the server over HTTPS, directly or behind a proxy that says so. */
export function isSecureRequest(request: Request): boolean {
  if (new URL(request.url).protocol === 'https:') return true;
  const forwarded = request.headers.get('x-forwarded-proto');
  return forwarded?.split(',')[0]?.trim().toLowerCase() === 'https';
}

/**
 * Adds the security headers a response does not already set. A response with immutable headers (the
 * assets binding's) is copied; any other is changed in place.
 */
export function withSecurityHeaders(response: Response, secure: boolean): Response {
  const pairs = secure ? [...SECURITY_HEADERS, HSTS_HEADER] : SECURITY_HEADERS;
  const missing = pairs.filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;
  try {
    for (const [name, value] of missing) response.headers.set(name, value);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    for (const [name, value] of missing) copy.headers.set(name, value);
    return copy;
  }
}
