import { bytesBody } from '../api/bytesBody.js';

/** An answer of the public pages, which always asks search engines to stay away. */
export function publicResponse(
  body: string | Uint8Array,
  contentType: string,
  cacheControl?: string,
  status = 200,
): Response {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Length': String(bytes.byteLength),
    'X-Robots-Tag': 'noindex',
  });
  if (cacheControl !== undefined) headers.set('Cache-Control', cacheControl);
  return new Response(bytesBody(bytes), { status, headers });
}
