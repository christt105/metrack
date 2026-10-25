import type { FetchFn } from '../../src/http/FetchFn.js';

export interface PathFetch {
  fetch: FetchFn;
  calls: string[];
}

/** A fetch that serves bodies by `origin + pathname`, ignoring the query string. Anything else answers 404. */
export function pathFetch(routes: Record<string, Buffer | object>): PathFetch {
  const calls: string[] = [];
  const fetchFn = ((input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    calls.push(url.toString());
    const body = routes[`${url.origin}${url.pathname}`];
    if (body === undefined) return Promise.resolve(new Response('missing', { status: 404 }));
    if (Buffer.isBuffer(body)) return Promise.resolve(new Response(new Uint8Array(body)));
    return Promise.resolve(Response.json(body));
  }) as FetchFn;
  return { fetch: fetchFn, calls };
}
