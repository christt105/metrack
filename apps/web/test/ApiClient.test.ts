import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/api/ApiClient';
import { ApiRequestError } from '../src/api/ApiRequestError';

function recorder(response: Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as unknown as typeof fetch;
  return { calls, client: new ApiClient(fetchFn) };
}

describe('ApiClient', () => {
  it('builds the list query string without empty values', async () => {
    const { calls, client } = recorder(new Response(JSON.stringify({ items: [], total: 0 })));
    await client.listMedia({ q: 'dan', status: 'completed', limit: 10, type: undefined });
    expect(calls[0]?.url).toBe('/api/media?q=dan&status=completed&limit=10');
  });

  it('sends JSON bodies', async () => {
    const { calls, client } = recorder(new Response('{}'));
    await client.patch('movies', 3, { rating: 7 });
    expect(calls[0]?.url).toBe('/api/movies/3');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe('{"rating":7}');
  });

  it('encodes free-text path segments', async () => {
    const { calls, client } = recorder(new Response('{}'));
    await client.removeRewatch('movies', 3, '2026/../x?y#z');
    expect(calls[0]?.url).toBe('/api/movies/3/rewatches/2026%2F..%2Fx%3Fy%23z');
    expect(calls[0]?.init?.method).toBe('DELETE');
  });

  it('turns an error body into an ApiRequestError', async () => {
    const body = { error: 'No such transition', code: 'invalid_transition', details: { x: 1 } };
    const { client } = recorder(new Response(JSON.stringify(body), { status: 409 }));
    const error = await client.patch('movies', 1, { status: 'planned' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: 'invalid_transition',
      message: 'No such transition',
      details: { x: 1 },
    });
  });

  it('returns a degraded health report answered with 503', async () => {
    const report = {
      status: 'degraded',
      appVersion: 'dev',
      schemaVersion: 0,
      features: { backups: false, sync: false },
    };
    const { client } = recorder(new Response(JSON.stringify(report), { status: 503 }));
    expect(await client.health()).toEqual(report);
  });

  it('maps a 204 to undefined and a thrown fetch to a network error', async () => {
    const { client } = recorder(new Response(null, { status: 204 }));
    expect(await client.remove('books', 1)).toBeUndefined();
    const broken = new ApiClient((async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch);
    await expect(broken.health()).rejects.toMatchObject({ code: 'network_error', status: 0 });
  });

  describe('uploadImage', () => {
    function uploader(encoding: 'server' | 'client' | 'fails') {
      const calls: { url: string; init?: RequestInit }[] = [];
      const fetchFn = (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url === '/api/images/usage') {
          if (encoding === 'fails') return new Response('{}', { status: 500 });
          return new Response(
            JSON.stringify({
              usedBytes: 0,
              quotaBytes: null,
              imageEncoding: encoding,
              maxDimension: 1280,
            }),
          );
        }
        return new Response('{"ref":"/api/images/abc"}', { status: 201 });
      }) as unknown as typeof fetch;
      const recoded = new Blob(['webp'], { type: 'image/webp' });
      const recode = vi.fn().mockResolvedValue(recoded);
      return { calls, recode, recoded, client: new ApiClient(fetchFn, undefined, recode) };
    }
    const file = new Blob(['jpeg'], { type: 'image/jpeg' });

    it('sends the file as it is when the server encodes', async () => {
      const { calls, client, recode } = uploader('server');
      await client.uploadImage(file);
      expect(recode).not.toHaveBeenCalled();
      expect(calls.at(-1)?.init?.body).toBe(file);
    });

    it('recodes first when the client encodes, and asks the mode only once', async () => {
      const { calls, client, recode, recoded } = uploader('client');
      await client.uploadImage(file);
      await client.uploadImage(file);
      expect(recode).toHaveBeenCalledWith(file, 1280);
      expect(calls.at(-1)?.init?.body).toBe(recoded);
      expect(calls.filter((call) => call.url === '/api/images/usage')).toHaveLength(1);
    });

    it('uploads the file as it is when the mode cannot be read, and asks again next time', async () => {
      const { calls, client, recode } = uploader('fails');
      await client.uploadImage(file);
      await client.uploadImage(file);
      expect(recode).not.toHaveBeenCalled();
      expect(calls.filter((call) => call.url === '/api/images/usage')).toHaveLength(2);
    });
  });
});
