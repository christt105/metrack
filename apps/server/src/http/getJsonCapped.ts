import type { FetchFn } from './FetchFn.js';
import { HttpError } from './HttpError.js';
import type { QueryParams } from './getJson.js';
import { ResponseTooLargeError } from './ResponseTooLargeError.js';

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
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new ResponseTooLargeError(where, maxBytes);
  }
  const reader = response.body?.getReader();
  if (!reader) return JSON.parse(await response.text()) as T;
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ResponseTooLargeError(where, maxBytes);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
