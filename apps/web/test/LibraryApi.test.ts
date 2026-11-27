import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { recorder } from './recordApi';

describe('LibraryApi', () => {
  it('builds the list query string without empty values', async () => {
    const { calls, client } = recorder(new Response(JSON.stringify({ items: [], total: 0 })));
    await client.library.listMedia({ q: 'dan', status: 'completed', limit: 10, type: undefined });
    expect(calls[0]?.url).toBe('/api/media?q=dan&status=completed&limit=10');
  });

  it('sends JSON bodies', async () => {
    const { calls, client } = recorder(new Response('{}'));
    await client.library.patch('movies', 3, { rating: 7 });
    expect(calls[0]?.url).toBe('/api/movies/3');
    expect(calls[0]?.init?.method).toBe('PATCH');
    expect(calls[0]?.init?.body).toBe('{"rating":7}');
  });

  it('encodes free-text path segments', async () => {
    const { calls, client } = recorder(new Response('{}'));
    await client.library.removeRewatch('movies', 3, '2026/../x?y#z');
    expect(calls[0]?.url).toBe('/api/movies/3/rewatches/2026%2F..%2Fx%3Fy%23z');
    expect(calls[0]?.init?.method).toBe('DELETE');
  });

  it('posts a viewing with an optional start', async () => {
    const first = recorder(new Response('{}'));
    await first.client.library.addRewatch('games', 2, '2026-01-02');
    const second = recorder(new Response('{}'));
    await second.client.library.addRewatch('games', 2, '2026-01-02', '2026-01-01');
    expect(first.calls[0]?.init?.body).toBe('{"finishedAt":"2026-01-02"}');
    expect(second.calls[0]?.init?.body).toBe(
      '{"startedAt":"2026-01-01","finishedAt":"2026-01-02"}',
    );
  });

  it('turns an error body into an ApiRequestError', async () => {
    const body = { error: 'No such transition', code: 'invalid_transition', details: { x: 1 } };
    const { client } = recorder(new Response(JSON.stringify(body), { status: 409 }));
    const error = await client.library
      .patch('movies', 1, { status: 'planned' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: 'invalid_transition',
      message: 'No such transition',
      details: { x: 1 },
    });
  });
});
