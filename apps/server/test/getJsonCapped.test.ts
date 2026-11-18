import { describe, expect, it } from 'vitest';
import type { FetchFn } from '../src/http/FetchFn.js';
import { getJsonCapped } from '../src/http/getJsonCapped.js';
import { HttpError } from '../src/http/HttpError.js';
import { ResponseTooLargeError } from '../src/http/ResponseTooLargeError.js';

const URL_ = 'https://example.test/doc';

const respond = (response: Response): FetchFn => (async () => response) as FetchFn;

describe('getJsonCapped', () => {
  it('parses a document under the limit, with its query string', async () => {
    let requested = '';
    const fetchFn = (async (input: URL) => {
      requested = input.toString();
      return Response.json({ a: 1 });
    }) as unknown as FetchFn;
    expect(await getJsonCapped(fetchFn, URL_, 100, { q: 'x', skip: undefined })).toEqual({ a: 1 });
    expect(requested).toBe(`${URL_}?q=x`);
  });

  it('refuses a declared length over the limit without reading the body', async () => {
    let pulled = false;
    const body = new ReadableStream(
      {
        pull() {
          pulled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const response = new Response(body, { headers: { 'content-length': '101' } });
    await expect(getJsonCapped(respond(response), URL_, 100)).rejects.toBeInstanceOf(
      ResponseTooLargeError,
    );
    expect(pulled).toBe(false);
  });

  it('abandons a body that grows past the limit while it is read', async () => {
    let chunks = 0;
    const body = new ReadableStream({
      pull(controller) {
        chunks += 1;
        controller.enqueue(new TextEncoder().encode('x'.repeat(40)));
      },
    });
    await expect(getJsonCapped(respond(new Response(body)), URL_, 100)).rejects.toBeInstanceOf(
      ResponseTooLargeError,
    );
    expect(chunks).toBeLessThan(10);
  });

  it('accepts a body of exactly the limit', async () => {
    const text = JSON.stringify({ k: 'x'.repeat(10) });
    const bytes = new TextEncoder().encode(text).byteLength;
    expect(await getJsonCapped(respond(new Response(text)), URL_, bytes)).toEqual({
      k: 'x'.repeat(10),
    });
  });

  it('fails like getJson on an error status', async () => {
    await expect(
      getJsonCapped(respond(new Response('no', { status: 500 })), URL_, 100),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      getJsonCapped(respond(new Response('no', { status: 500 })), URL_, 100),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
