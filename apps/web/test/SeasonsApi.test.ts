import { describe, expect, it } from 'vitest';
import { ApiClient } from '../src/api/ApiClient';

describe('SeasonsApi', () => {
  it('asks to change a shared catalog field for everyone only when told to', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = new ApiClient((async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}');
    }) as unknown as typeof fetch);
    await client.library.patch('seasons', 3, { tmdbSeasonNumber: 2 }, { forAll: true });
    await client.seasons.setSeasonOrdering(4, 'g1');
    await client.seasons.setSeasonOrdering(4, null, { forAll: true });
    await client.seasons.episodeGroups(4);
    await client.seasons.updateSeasonEpisodes(5, { op: 'unmark', keys: ['s1e2'] });
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
});
