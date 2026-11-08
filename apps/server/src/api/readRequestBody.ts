import { ApiError } from './ApiError.js';

/** Largest body a route accepts unless it asks for more: one mebibyte. */
export const DEFAULT_BODY_LIMIT = 1_048_576;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const NO_BODY_METHODS = new Set(['GET', 'HEAD']);

export interface BodyOptions {
  limit: number;
  /** Accepts these content types as raw bytes. */
  rawTypes?: RegExp;
}

function tooLarge(): ApiError {
  return new ApiError(413, 'body_too_large', 'The request body is too large');
}

async function readBytes(request: Request, limit: number): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared !== null && Number(declared) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function hasPollutedKeys(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (Object.hasOwn(value, '__proto__')) return true;
  const record = value as Record<string, unknown>;
  if (
    Object.hasOwn(record, 'constructor') &&
    typeof record.constructor === 'object' &&
    record.constructor !== null &&
    Object.hasOwn(record.constructor, 'prototype')
  ) {
    return true;
  }
  return Object.values(record).some(hasPollutedKeys);
}

function parseJson(text: string): unknown {
  if (text === '') {
    throw new ApiError(
      400,
      'bad_request',
      "Body cannot be empty when content-type is set to 'application/json'",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(
      400,
      'bad_request',
      "Body is not valid JSON but content-type is set to 'application/json'",
    );
  }
  if (hasPollutedKeys(parsed)) {
    throw new ApiError(
      400,
      'bad_request',
      "Body is not valid JSON but content-type is set to 'application/json'",
    );
  }
  return parsed;
}

function mediaType(header: string): string {
  return (header.split(';')[0] ?? '').trim().toLowerCase();
}

/**
 * The parsed body of a request: JSON, plain text, or raw bytes for the types a route accepts as files. A request
 * with nothing to parse has no body, and an unknown content type is refused with 415.
 */
export async function readRequestBody(request: Request, options: BodyOptions): Promise<unknown> {
  const method = request.method;
  if (NO_BODY_METHODS.has(method)) return undefined;
  const contentType = request.headers.get('content-type');
  const declared = request.headers.get('content-length');
  const streamed = request.headers.has('transfer-encoding');
  if (BODY_METHODS.has(method)) {
    if (contentType === null && !streamed && (declared === null || declared === '0')) {
      return undefined;
    }
  } else if (contentType === null) {
    return undefined;
  }
  const type = mediaType(contentType ?? '');
  const raw = options.rawTypes?.test(type) ?? false;
  if (type !== 'application/json' && type !== 'text/plain' && !raw) {
    throw new ApiError(415, 'bad_request', 'Unsupported Media Type');
  }
  const bytes = await readBytes(request, options.limit);
  if (raw) return bytes;
  const text = new TextDecoder().decode(bytes);
  return type === 'application/json' ? parseJson(text) : text;
}
