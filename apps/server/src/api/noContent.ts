/** An empty 204 answer. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}
