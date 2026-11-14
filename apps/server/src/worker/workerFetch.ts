import type { FetchFn } from '../http/FetchFn.js';

/** The global `fetch`, called unbound: workerd rejects `fetch` invoked as a method of another object. */
export const workerFetch: FetchFn = (input, init) => fetch(input, init);
