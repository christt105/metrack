import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaSummary } from '@metrack/domain';
import { pathFetch } from './support/pathFetch.js';
import { insertSeason } from './support/insertSeason.js';
import { createTestApi, type TestApi } from './support/createTestApi.js';

let api: TestApi;

beforeEach(async () => {
  api = await createTestApi(pathFetch({}).fetch);
});

async function createSeries(title: string): Promise<number> {
  const response = await api.app.inject({ method: 'POST', url: '/api/series', payload: { title } });
  return response.json().id;
}

async function list(query = ''): Promise<MediaSummary[]> {
  const response = await api.app.inject({ method: 'GET', url: `/api/media?limit=100${query}` });
  return response.json().items;
}

const find = (items: MediaSummary[], type: string, title: string) =>
  items.find((item) => item.type === type && item.title === title);

describe('series watching flag', () => {
  beforeEach(async () => {
    const live = await createSeries('Live');
    await insertSeason(api, live, { number: 1, status: 'completed' });
    await insertSeason(api, live, { number: 2, status: 'in_progress' });
    await insertSeason(api, live, { number: 3, status: 'planned' });
    const again = await createSeries('Again');
    await insertSeason(api, again, {
      number: 1,
      status: 'completed',
      rewatches: [{ startedAt: '2026-05-01', finishedAt: null }],
    });
    await insertSeason(api, again, { number: 2, status: 'completed' });
    await insertSeason(api, again, { number: 3, status: 'completed' });
    const done = await createSeries('Done');
    await insertSeason(api, done, {
      number: 1,
      status: 'completed',
      rewatches: [{ startedAt: '2026-05-01', finishedAt: '2026-05-02' }],
    });
    await insertSeason(api, done, { number: 2, status: 'completed' });
  });

  it('marks a series with a season in progress or an open rewatch, and not a finished one', async () => {
    const items = await list();
    expect(find(items, 'series', 'Live')).toMatchObject({ status: null, watching: true });
    expect(find(items, 'series', 'Again')).toMatchObject({ status: null, watching: true });
    expect(find(items, 'series', 'Done')).toMatchObject({ status: null, watching: false });
  });

  it('flags the seasons themselves the same way', async () => {
    const items = await list();
    const flags = items.filter((item) => item.type === 'season').map((s) => s.watching);
    expect(flags.filter(Boolean)).toHaveLength(2);
  });

  it('leaves the status filter and the series status untouched', async () => {
    const titles = (items: MediaSummary[]) => items.map((item) => item.title).sort();
    const inProgress = await list('&status=in_progress');
    expect(titles(inProgress.filter((item) => item.type === 'series'))).toEqual(['Live']);
    const completed = await list('&status=completed');
    expect(titles(completed.filter((item) => item.type === 'series'))).toEqual([
      'Again',
      'Done',
      'Live',
    ]);
  });
});
