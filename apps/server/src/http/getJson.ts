import type { FetchFn } from './FetchFn.js';
import { HttpError } from './HttpError.js';

export type QueryParams = Record<string, string | number | boolean | undefined>;

/** GETs a JSON document, appending defined, non-empty `params` as a query string. */
export async function getJson<T>(
  fetchFn: FetchFn,
  url: string,
  params: QueryParams = {},
  headers: Record<string, string> = {},
): Promise<T> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') target.searchParams.append(key, String(value));
  }
  const response = await fetchFn(target, { headers: { Accept: 'application/json', ...headers } });
  if (!response.ok) {
    throw new HttpError(
      `Request failed (${response.status}) for ${target.origin}${target.pathname}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}
