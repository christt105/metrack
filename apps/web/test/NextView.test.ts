import { enableAutoUnmount, flushPromises, type VueWrapper } from '@vue/test-utils';
import type { NextEpisodeRow } from '@metrack/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NextView from '../src/views/NextView.vue';
import { todayIso } from '../src/logic/todayIso';
import { mountWithApi } from './mountWithApi';

enableAutoUnmount(afterEach);

const row = (id: number, patch: Partial<NextEpisodeRow> = {}): NextEpisodeRow => ({
  series: { id, title: `Series ${id}`, cover: null, banner: null },
  season: { id: id * 10, number: 3, title: null, cover: null, episodeCount: 12 },
  episode: {
    number: 7,
    key: `k${id}`,
    title: 'The Title',
    stillPath: null,
    runtime: 24,
    airDate: '2020-01-01',
    filler: null,
  },
  source: 'tmdb',
  availability: 'ready',
  airsOn: null,
  labels: [],
  progress: { watched: 6, total: 12, skipped: 0, rewatch: false },
  lastActivityAt: null,
  ...patch,
});

async function mountNext(rows: NextEpisodeRow[], api: Record<string, unknown> = {}) {
  const nextEpisodes = vi.fn().mockResolvedValue({ rows });
  const updateSeasonEpisodes = vi.fn().mockResolvedValue({});
  const mounted = await mountWithApi(NextView, {
    nextEpisodes,
    updateSeasonEpisodes,
    ...api,
  } as never);
  await flushPromises();
  return { ...mounted, nextEpisodes, updateSeasonEpisodes };
}

const markButton = (wrapper: VueWrapper, id: number) => wrapper.find(`[data-series="${id}"] .mark`);

describe('NextView', () => {
  it('shows an empty state with a link to the library', async () => {
    const { wrapper } = await mountNext([]);
    expect(wrapper.text()).toContain('Nothing to watch next');
    expect(wrapper.find('.empty a').attributes('href')).toBe('/');
  });

  it('shows one row per series with the episode label, title and progress', async () => {
    const { wrapper } = await mountNext([row(1, { labels: ['rewatch'] }), row(2)]);
    expect(wrapper.findAll('li.next')).toHaveLength(2);
    const first = wrapper.find('[data-series="1"]');
    expect(first.text()).toContain('Series 1');
    expect(first.text()).toContain('S3 · E7');
    expect(first.text()).toContain('The Title');
    expect(first.text()).toContain('Rewatch');
    expect(first.find('a').attributes('href')).toBe('/seasons/10');
  });

  it('marks with the mark operation, replaces only that row and moves it first', async () => {
    const updated = row(2, { episode: { ...row(2).episode, number: 8, key: 'k2b' } });
    const nextEpisodes = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row(1), row(2)] })
      .mockResolvedValueOnce({ rows: [updated] });
    const { wrapper, updateSeasonEpisodes } = await mountNext([], { nextEpisodes });
    await markButton(wrapper, 2).trigger('click');
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenCalledWith(20, {
      op: 'mark',
      keys: ['k2'],
      date: todayIso(),
    });
    expect(nextEpisodes).toHaveBeenLastCalledWith(2);
    const rows = wrapper.findAll('li.next');
    expect(rows[0]!.attributes('data-series')).toBe('2');
    expect(rows[0]!.text()).toContain('S3 · E8');
    expect(rows[1]!.text()).toContain('S3 · E7');
    expect(document.body.textContent).toContain('Episode marked');
  });

  it('marks a row without catalog by number', async () => {
    const numbers = row(1, {
      source: 'numbers',
      episode: { ...row(1).episode, key: null, title: null, number: 5 },
      season: { ...row(1).season, number: 4 },
    });
    const { wrapper, updateSeasonEpisodes } = await mountNext([numbers]);
    expect(wrapper.find('[data-series="1"]').text()).toContain('S4 · E5');
    await markButton(wrapper, 1).trigger('click');
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenCalledWith(10, {
      op: 'mark',
      keys: ['s4e5'],
      date: todayIso(),
    });
  });

  it('skips with the skip operation and highlights the skip button for filler', async () => {
    const filler = row(1, { episode: { ...row(1).episode, filler: 'filler' } });
    const { wrapper, updateSeasonEpisodes } = await mountNext([filler, row(2)]);
    expect(wrapper.find('[data-series="1"] .skip').classes()).toContain('highlight');
    expect(wrapper.find('[data-series="2"] .skip').classes()).not.toContain('highlight');
    await wrapper.find('[data-series="1"] .skip').trigger('click');
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenCalledWith(10, { op: 'skip', keys: ['k1'] });
    expect(document.body.textContent).toContain('Episode skipped');
  });

  it('undoes a mark by unmarking and asking for the row again', async () => {
    const { wrapper, updateSeasonEpisodes, nextEpisodes } = await mountNext([row(1)]);
    await markButton(wrapper, 1).trigger('click');
    await flushPromises();
    const undo = document.body.querySelector('.toast .undo') as HTMLButtonElement;
    undo.click();
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenLastCalledWith(10, { op: 'unmark', keys: ['k1'] });
    expect(nextEpisodes).toHaveBeenCalledTimes(3);
  });

  it('undoes a skip by unskipping', async () => {
    const { wrapper, updateSeasonEpisodes } = await mountNext([row(1)]);
    await wrapper.find('[data-series="1"] .skip').trigger('click');
    await flushPromises();
    (document.body.querySelector('.toast .undo') as HTMLButtonElement).click();
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenLastCalledWith(10, { op: 'unskip', keys: ['k1'] });
  });

  it('restores the earlier viewings when undoing a mark during a rewatch', async () => {
    const watched = {
      key: 'k1',
      number: 7,
      tmdbId: 1,
      title: 't',
      airDate: null,
      runtime: null,
      overview: null,
      stillPath: null,
      watched: true,
      skipped: false,
      viewings: [{ startedAt: null, finishedAt: '2020-02-02' }],
      filler: null,
    };
    const seasonEpisodes = vi.fn().mockResolvedValue({ episodes: [watched] });
    const { wrapper, updateSeasonEpisodes } = await mountNext([row(1, { labels: ['rewatch'] })], {
      seasonEpisodes,
    });
    await markButton(wrapper, 1).trigger('click');
    await flushPromises();
    (document.body.querySelector('.toast .undo') as HTMLButtonElement).click();
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenLastCalledWith(10, {
      op: 'setViewings',
      key: 'k1',
      viewings: [{ startedAt: null, finishedAt: '2020-02-02' }],
    });
  });

  it('ignores a second tap while the row is busy', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const updateSeasonEpisodes = vi.fn().mockReturnValue(new Promise((r) => (finish = r)));
    const { wrapper } = await mountNext([row(1)], { updateSeasonEpisodes });
    const button = markButton(wrapper, 1);
    await button.trigger('click');
    await button.trigger('click');
    expect(updateSeasonEpisodes).toHaveBeenCalledTimes(1);
    expect(button.attributes('disabled')).toBeDefined();
    finish({});
    await flushPromises();
    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('shows the air date without buttons when the episode has not aired', async () => {
    const waiting = row(1, { availability: 'airs', airsOn: '2030-11-28' });
    const { wrapper } = await mountNext([waiting]);
    const item = wrapper.find('[data-series="1"]');
    expect(item.text()).toContain('S3 · E7 airs on 28 Nov 2030');
    expect(item.find('button').exists()).toBe(false);
  });

  it('shows the premiere date of a season not aired yet', async () => {
    const waiting = row(1, { availability: 'premieres', airsOn: '2030-11-28' });
    const { wrapper } = await mountNext([waiting]);
    expect(wrapper.find('[data-series="1"]').text()).toContain('S3 premieres on 28 Nov 2030');
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('shows the error when marking fails and keeps the row', async () => {
    const updateSeasonEpisodes = vi.fn().mockRejectedValue(new Error('boom'));
    const { wrapper } = await mountNext([row(1)], { updateSeasonEpisodes });
    await markButton(wrapper, 1).trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.findAll('li.next')).toHaveLength(1);
  });

  it('drops the row when nothing is next for the series any more', async () => {
    const nextEpisodes = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row(1), row(2)] })
      .mockResolvedValueOnce({ rows: [] });
    const { wrapper } = await mountNext([], { nextEpisodes });
    await markButton(wrapper, 1).trigger('click');
    await flushPromises();
    expect(wrapper.findAll('li.next').map((li) => li.attributes('data-series'))).toEqual(['2']);
  });
});
