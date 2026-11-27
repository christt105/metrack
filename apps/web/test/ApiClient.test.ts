import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../src/api/ApiClient';

describe('ApiClient', () => {
  it('asks to change a shared catalog field for everyone only when told to', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = new ApiClient((async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}');
    }) as unknown as typeof fetch);
    await client.library.patch('seasons', 3, { tmdbSeasonNumber: 2 }, { forAll: true });
    await client.setSeasonOrdering(4, 'g1');
    await client.setSeasonOrdering(4, null, { forAll: true });
    await client.episodeGroups(4);
    await client.updateSeasonEpisodes(5, { op: 'unmark', keys: ['s1e2'] });
    expect(calls.map((c) => `${c.init?.method ?? 'GET'} ${c.url}`)).toEqual([
      'PATCH /api/seasons/3?forAll=true',
      'PUT /api/series/4/season-ordering',
      'PUT /api/series/4/season-ordering?forAll=true',
      'GET /api/series/4/episode-groups',
      'PATCH /api/seasons/5/episodes',
    ]);
    expect(calls[1]?.init?.body).toBe('{"episodeGroup":"g1"}');
    expect(calls[4]?.init?.body).toBe('{"op":"unmark","keys":["s1e2"]}');
  });

  describe('imageBytes', () => {
    it('returns bytes and reports that the API is reachable', async () => {
      const contents = Uint8Array.of(4, 21, 255);
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(contents));
      const onReachable = vi.fn();
      const client = new ApiClient(fetchFn, undefined, undefined, onReachable);

      expect(await client.imageBytes('abc')).toEqual(contents);
      expect(fetchFn).toHaveBeenCalledWith('/api/images/abc', { method: 'GET' });
      expect(onReachable).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('reports an expired session while translating a 401 from the image endpoint', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Please sign in', code: 'unauthenticated' }), {
          status: 401,
        }),
      );
      const onUnauthenticated = vi.fn();
      const onReachable = vi.fn();
      const client = new ApiClient(fetchFn, onUnauthenticated, undefined, onReachable);

      await expect(client.imageBytes('abc')).rejects.toMatchObject({
        status: 401,
        code: 'unauthenticated',
        message: 'Please sign in',
      });
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
      expect(onReachable).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('reports loss of connectivity when the image request cannot reach the API', async () => {
      const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
      const onUnauthenticated = vi.fn();
      const onReachable = vi.fn();
      const client = new ApiClient(fetchFn, onUnauthenticated, undefined, onReachable);

      await expect(client.imageBytes('abc')).rejects.toMatchObject({
        status: 0,
        code: 'network_error',
        message: 'offline',
      });
      expect(onReachable).toHaveBeenCalledExactlyOnceWith(false);
      expect(onUnauthenticated).not.toHaveBeenCalled();
    });
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
