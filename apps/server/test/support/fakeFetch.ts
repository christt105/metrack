import type { FetchFn } from '../../src/http/FetchFn.js';

export interface FakeFetch {
  fetch: FetchFn;
  calls: string[];
}

/** A fetch that serves the given bodies by URL and answers 404 for anything else. Objects are sent as JSON. */
export function fakeFetch(routes: Record<string, Buffer | object>): FakeFetch {
  const calls: string[] = [];
  const fetchFn = ((input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push(url);
    const body = routes[url];
    if (body === undefined) return Promise.resolve(new Response('missing', { status: 404 }));
    if (Buffer.isBuffer(body)) return Promise.resolve(new Response(new Uint8Array(body)));
    return Promise.resolve(Response.json(body));
  }) as FetchFn;
  return { fetch: fetchFn, calls };
}
