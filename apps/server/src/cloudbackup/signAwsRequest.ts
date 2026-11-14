import { createHash, createHmac } from 'node:crypto';
import type { SignedRequestOptions } from './SignedRequestOptions.js';

export const EMPTY_PAYLOAD_HASH = createHash('sha256').digest('hex');

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalQuery(url: URL): string {
  return [...url.searchParams.entries()]
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

/** Signs a request with AWS Signature Version 4 and returns the headers to send, `authorization` included. */
export function signAwsRequest(options: SignedRequestOptions): Record<string, string> {
  const stamp = options.date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const day = stamp.slice(0, 8);
  const payloadHash = options.payloadHash ?? EMPTY_PAYLOAD_HASH;
  const headers: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(options.headers ?? {}).map(([name, value]) => [
        name.toLowerCase(),
        value.trim(),
      ]),
    ),
    host: options.url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
  };
  const names = Object.keys(headers).sort();
  const canonical = [
    options.method,
    options.url.pathname,
    canonicalQuery(options.url),
    ...names.map((name) => `${name}:${headers[name]}`),
    '',
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${day}/${options.region}/${options.service}/aws4_request`;
  const toSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    createHash('sha256').update(canonical).digest('hex'),
  ].join('\n');
  const key = hmac(
    hmac(hmac(hmac(`AWS4${options.secretAccessKey}`, day), options.region), options.service),
    'aws4_request',
  );
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  };
}
