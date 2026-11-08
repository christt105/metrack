import { describe, expect, it } from 'vitest';
import { readRequestBody } from '../src/api/readRequestBody.js';

const options = { limit: 20, rawTypes: /^image\//i };

function post(body: BodyInit | null, headers: Record<string, string> = {}, method = 'POST') {
  return new Request('http://localhost/x', { method, body, headers });
}

describe('readRequestBody', () => {
  it('has no body for a request with nothing to parse', async () => {
    expect(await readRequestBody(post(null), options)).toBeUndefined();
    expect(await readRequestBody(new Request('http://localhost/x'), options)).toBeUndefined();
    expect(await readRequestBody(post(null, {}, 'DELETE'), options)).toBeUndefined();
    await expect(
      readRequestBody(post(null, { 'content-type': 'application/json' }, 'DELETE'), options),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('parses JSON and plain text', async () => {
    const json = { 'content-type': 'application/json; charset=utf-8' };
    expect(await readRequestBody(post('{"a":1}', json), options)).toEqual({ a: 1 });
    expect(await readRequestBody(post('hi', { 'content-type': 'text/plain' }), options)).toBe('hi');
  });

  it('refuses empty, invalid and poisoned JSON with 400', async () => {
    const json = { 'content-type': 'application/json' };
    for (const text of ['', '{bad', '{"__proto__":{}}']) {
      await expect(readRequestBody(post(text, json), options)).rejects.toMatchObject({
        status: 400,
        code: 'bad_request',
      });
    }
  });

  it('refuses a content type nobody reads with 415', async () => {
    await expect(
      readRequestBody(post('x', { 'content-type': 'text/xml' }), options),
    ).rejects.toMatchObject({ status: 415 });
  });

  it('hands raw types over as bytes', async () => {
    const body = await readRequestBody(
      post(new Uint8Array([1, 2]), { 'content-type': 'image/png' }),
      options,
    );
    expect(body).toEqual(new Uint8Array([1, 2]));
  });

  it('refuses a body over the limit, by its declared length or while reading', async () => {
    const big = 'x'.repeat(21);
    const json = { 'content-type': 'text/plain' };
    await expect(readRequestBody(post(big, json), options)).rejects.toMatchObject({
      status: 413,
      code: 'body_too_large',
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    });
    const streamed = new Request('http://localhost/x', {
      method: 'POST',
      body: stream,
      headers: json,
      duplex: 'half',
    } as RequestInit);
    await expect(readRequestBody(streamed, options)).rejects.toMatchObject({ status: 413 });
  });
});
