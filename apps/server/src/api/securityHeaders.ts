import { CONTENT_SECURITY_POLICY_HEADER } from './contentSecurityPolicyHeader.js';
import { contentSecurityPolicyFor } from './contentSecurityPolicyFor.js';
import { generateCspNonce } from './generateCspNonce.js';
import { isHtmlResponse } from './isHtmlResponse.js';
import { withScriptNonce } from './withScriptNonce.js';

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
 * Adds the security headers a response does not already set, with the content security
 * policy that fits the request path. An HTML document (and a 304 for one) always gets the policy with a
 * fresh `script-src` nonce, replacing any other, for the scripts Cloudflare injects into HTML. A response
 * with immutable headers (the assets binding's) is copied; any other is changed in place.
 */
export function withSecurityHeaders(response: Response, secure: boolean, path: string): Response {
  const fixed = secure ? [...SECURITY_HEADERS, HSTS_HEADER] : SECURITY_HEADERS;
  const policy = contentSecurityPolicyFor(path);
  const nonced = isHtmlResponse(response) || response.status === 304;
  const pairs: readonly (readonly [string, string])[] = [
    ...fixed,
    [CONTENT_SECURITY_POLICY_HEADER, nonced ? withScriptNonce(policy, generateCspNonce()) : policy],
  ];
  const missing = pairs.filter(
    ([name]) => (nonced && name === CONTENT_SECURITY_POLICY_HEADER) || !response.headers.has(name),
  );
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
