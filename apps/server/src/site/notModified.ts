/** The 304 for a visitor who already holds the current render of a public page. */
export function notModified(etag: string, cacheControl: string): Response {
  return new Response(null, {
    status: 304,
    headers: { ETag: etag, 'Cache-Control': cacheControl, 'X-Robots-Tag': 'noindex' },
  });
}
