import { describe, expect, it } from 'vitest';
import { fetchHealth } from '../src/api/fetchHealth';

describe('fetchHealth', () => {
  it('returns the parsed report', async () => {
    const report = { status: 'ok', appVersion: 'x', schemaVersion: 1 };
    const fakeFetch = (async () => new Response(JSON.stringify(report))) as typeof fetch;
    expect(await fetchHealth(fakeFetch)).toEqual(report);
  });

  it('throws on a failed response', async () => {
    const fakeFetch = (async () => new Response('', { status: 500 })) as typeof fetch;
    await expect(fetchHealth(fakeFetch)).rejects.toThrow('500');
  });
});
