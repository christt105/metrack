/** A JSON answer with the status and content type every API route uses. */
export function jsonResponse(body: unknown, status = 200): Response {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return new Response(bytes, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(bytes.byteLength),
    },
  });
}
