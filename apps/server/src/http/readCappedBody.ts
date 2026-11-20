import { ResponseTooLargeError } from './ResponseTooLargeError.js';

/**
 * Reads a response body that must not exceed `maxBytes`. A declared `Content-Length` over the limit is refused
 * before reading anything, and a body that grows past it is abandoned as soon as it does.
 */
export async function readCappedBody(
  response: Response,
  where: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new ResponseTooLargeError(where, maxBytes);
  }
  const reader = response.body?.getReader();
  if (!reader) return new TextEncoder().encode(await response.text());
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
  return bytes;
}
