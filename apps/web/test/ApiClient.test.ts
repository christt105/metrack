import { describe, expect, it } from 'vitest';
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

  it('maps a 204 to undefined and a thrown fetch to a network error', async () => {
    const { client } = recorder(new Response(null, { status: 204 }));
    expect(await client.remove('books', 1)).toBeUndefined();
    const broken = new ApiClient((async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch);
    await expect(broken.health()).rejects.toMatchObject({ code: 'network_error', status: 0 });
  });
});
