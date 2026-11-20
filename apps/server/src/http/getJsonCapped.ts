import type { FetchFn } from './FetchFn.js';
import { HttpError } from './HttpError.js';
import type { QueryParams } from './getJson.js';
import { readCappedBody } from './readCappedBody.js';

/**
 * GETs a JSON document that must not exceed `maxBytes`. A declared `Content-Length` over the limit is refused
 * before reading anything, and a body that grows past it is abandoned as soon as it does, so an oversized
 * document is never buffered whole or parsed.
 */
export async function getJsonCapped<T>(
  fetchFn: FetchFn,
  url: string,
  maxBytes: number,
  params: QueryParams = {},
  headers: Record<string, string> = {},
): Promise<T> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') target.searchParams.append(key, String(value));
  }
  const where = `${target.origin}${target.pathname}`;
  const response = await fetchFn(target, { headers: { Accept: 'application/json', ...headers } });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(`Request failed (${response.status}) for ${where}`, response.status);
  }
  return JSON.parse(new TextDecoder().decode(await readCappedBody(response, where, maxBytes))) as T;
}
