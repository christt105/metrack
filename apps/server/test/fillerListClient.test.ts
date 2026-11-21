import { describe, expect, it } from 'vitest';
import type { FetchFn } from '../src/http/FetchFn.js';
import { FillerListClient } from '../src/filler/FillerListClient.js';

const page =
  '<tr class="filler odd"><td class="Number">1</td><td class="Title"><a>One</a></td></tr>';

describe('FillerListClient', () => {
  it('requests the show page with a metrack user agent and a timeout and parses it', async () => {
    let seen: { url: string; agent: string | null; signal: boolean } | undefined;
    const fetchFn = (async (input: string | URL, init?: RequestInit) => {
      seen = {
        url: String(input),
        agent: new Headers(init?.headers).get('user-agent'),
        signal: init?.signal !== undefined,
      };
      return new Response(page);
    }) as FetchFn;
    const list = await new FillerListClient(fetchFn).list('naruto');
    expect(list).toEqual([{ number: 1, category: 'filler', title: 'One' }]);
    expect(seen).toEqual({
      url: 'https://www.animefillerlist.com/shows/naruto',
      agent: 'metrack (+https://github.com/christt105/metrack)',
      signal: true,
    });
  });

  it('treats a 404 as no list and other failures as errors', async () => {
    const missing = (async () => new Response('', { status: 404 })) as FetchFn;
    expect(await new FillerListClient(missing).list('x')).toEqual([]);
    const down = (async () => new Response('', { status: 500 })) as FetchFn;
    await expect(new FillerListClient(down).list('x')).rejects.toThrow();
  });

  it('refuses a body over the size limit', async () => {
    const big = (async () =>
      new Response(page, { headers: { 'content-length': '5000000' } })) as FetchFn;
    await expect(new FillerListClient(big).list('x')).rejects.toThrow(/over/);
    const streamed = (async () => new Response('a'.repeat(2_100_000))) as FetchFn;
    await expect(new FillerListClient(streamed).list('x')).rejects.toThrow(/over/);
  });
});
