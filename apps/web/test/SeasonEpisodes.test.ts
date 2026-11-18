import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import type { SeasonEpisodeItem, SeasonEpisodesResponse } from '@metrack/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SeasonEpisodes from '../src/components/SeasonEpisodes.vue';
import { todayIso } from '../src/logic/todayIso';
import { mountWithApi } from './mountWithApi';

enableAutoUnmount(afterEach);

const today = todayIso();
const viewing = { startedAt: null, finishedAt: '2026-02-02' };
const item = (number: number, patch: Partial<SeasonEpisodeItem> = {}): SeasonEpisodeItem => ({
  key: `k${number}`,
  number,
  tmdbId: 100 + number,
  title: `Title ${number}`,
  airDate: '2020-01-01',
  runtime: 24,
  overview: `About ${number}`,
  stillPath: null,
  watched: false,
  viewings: [],
  ...patch,
});
const response = (
  episodes: SeasonEpisodeItem[],
  patch: Partial<SeasonEpisodesResponse> = {},
): SeasonEpisodesResponse => ({
  seasonId: 50,
  source: 'tmdb',
  fetchedAt: '2026-01-01',
  complete: true,
  datesDerived: false,
  episodeCount: episodes.length,
  watchedCount: episodes.filter((e) => e.watched).length,
  episodes,
  ...patch,
});
const tracking = (status = 'in_progress') => ({
  status,
  startedAt: null,
  finishedAt: null,
  rewatches: [],
});

async function mountList(
  episodes: SeasonEpisodeItem[],
  api: Record<string, unknown> = {},
  patch: Partial<SeasonEpisodesResponse> = {},
) {
  const seasonEpisodes = vi.fn().mockResolvedValue(response(episodes, patch));
  const mounted = await mountWithApi(SeasonEpisodes, { seasonEpisodes, ...api } as never, {
    seasonId: 50,
    seriesId: 7,
    status: 'in_progress',
  });
  await flushPromises();
  return { ...mounted, seasonEpisodes };
}

const rows = (wrapper: { findAll: (s: string) => { text: () => string }[] }) =>
  wrapper.findAll('li.episode');

describe('SeasonEpisodes', () => {
  it('loads the episodes of its season and shows number, title, date and runtime', async () => {
    const { wrapper, seasonEpisodes } = await mountList([
      item(1, { watched: true, viewings: [viewing, viewing, viewing] }),
      item(2, { airDate: '2999-01-01' }),
    ]);
    expect(seasonEpisodes).toHaveBeenCalledWith(50);
    const first = rows(wrapper)[0]!.text();
    expect(first).toContain('Title 1');
    expect(first).toContain('1 Jan 2020');
    expect(first).toContain('24 min');
    expect(first).toContain('×3');
    expect(wrapper.text()).toContain('1 of 2 episodes');
    const second = wrapper.findAll('li.episode')[1]!;
    expect(second.classes()).toContain('unaired');
    expect(second.find('button.check').attributes('disabled')).toBeDefined();
  });

  it('shows bare numbers when the source is numbers', async () => {
    const { wrapper } = await mountList([item(1, { title: null })], {}, { source: 'numbers' });
    expect(rows(wrapper)[0]!.text()).toContain('Episode 1');
  });

  it('expands the overview on tap', async () => {
    const { wrapper } = await mountList([item(1)]);
    expect(wrapper.text()).not.toContain('About 1');
    await wrapper.find('li.episode button.text').trigger('click');
    expect(wrapper.text()).toContain('About 1');
  });

  it('marks one episode with today and undoes it with an unmark', async () => {
    const update = vi
      .fn()
      .mockResolvedValueOnce({
        ...response([item(1, { watched: true }), item(2)]),
        tracking: tracking(),
      })
      .mockResolvedValueOnce({ ...response([item(1), item(2)]), tracking: tracking() });
    const { wrapper } = await mountList([item(1), item(2)], { updateSeasonEpisodes: update });
    await wrapper.find('li.episode button.check').trigger('click');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, { op: 'mark', keys: ['k1'], date: today });
    expect(wrapper.emitted('updated')).toHaveLength(1);
    const toast = document.body.querySelector('.toast')!;
    expect(toast.textContent).toContain('Episode marked');
    (toast.querySelector('.undo') as HTMLElement).click();
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'unmark', keys: ['k1'] });
  });

  it('unmarks a watched episode and undo restores its viewings', async () => {
    const update = vi.fn().mockResolvedValue({ ...response([item(1)]), tracking: tracking() });
    const { wrapper } = await mountList([item(1, { watched: true, viewings: [viewing] })], {
      updateSeasonEpisodes: update,
    });
    await wrapper.find('li.episode button.check').trigger('click');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, { op: 'unmark', keys: ['k1'] });
    (document.body.querySelector('.toast .undo') as HTMLElement).click();
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, {
      op: 'setViewings',
      key: 'k1',
      viewings: [viewing],
    });
  });

  it('marks up to an episode, only the unwatched aired ones', async () => {
    const update = vi.fn().mockResolvedValue({ ...response([]), tracking: tracking() });
    const { wrapper } = await mountList(
      [item(1, { watched: true, viewings: [viewing] }), item(2), item(3), item(4)],
      { updateSeasonEpisodes: update },
    );
    await wrapper.findAll('li.episode')[2]!.find('button.text').trigger('click');
    await wrapper.findAll('li.episode')[2]!.find('.body button.small').trigger('click');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, { op: 'mark', keys: ['k2', 'k3'], date: today });
  });

  it('marks every aired episode, with or without a date', async () => {
    const episodes = [item(1), item(2), item(3, { airDate: '2999-01-01' })];
    const update = vi.fn().mockResolvedValue({ ...response(episodes), tracking: tracking() });
    const { wrapper } = await mountList(episodes, { updateSeasonEpisodes: update });
    const [all, undated] = wrapper.findAll('.actions button');
    await all!.trigger('click');
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', keys: ['k1', 'k2'], date: today });
    await undated!.trigger('click');
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', keys: ['k1', 'k2'], date: null });
  });

  it('says the status changed and that undo does not revert it', async () => {
    const update = vi.fn().mockResolvedValue({
      ...response([item(1, { watched: true })]),
      tracking: tracking('completed'),
    });
    const { wrapper } = await mountList([item(1)], { updateSeasonEpisodes: update });
    await wrapper.find('.actions button').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('.toast')!.textContent).toContain(
      'Season is now Completed. Undo keeps that status.',
    );
  });

  it('edits the viewings of a watched episode with setViewings', async () => {
    const update = vi.fn().mockResolvedValue({ ...response([]), tracking: tracking() });
    const { wrapper } = await mountList([item(1, { watched: true, viewings: [viewing] })], {
      updateSeasonEpisodes: update,
    });
    await wrapper.find('li.episode button.text').trigger('click');
    const add = wrapper.find('.viewings form.add');
    await add.find('input[required]').setValue('2026-03-03');
    await add.trigger('submit');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, {
      op: 'setViewings',
      key: 'k1',
      viewings: [viewing, { startedAt: null, finishedAt: '2026-03-03' }],
    });
  });

  it('shows a still from TMDB only when the episode has one', async () => {
    const { wrapper } = await mountList([item(1, { stillPath: '/a.jpg' }), item(2)]);
    const [first, second] = wrapper.findAll('li.episode');
    const image = first!.find('img.still');
    expect(image.attributes('src')).toBe('https://image.tmdb.org/t/p/w300/a.jpg');
    expect(image.attributes('loading')).toBe('lazy');
    expect(second!.find('img').exists()).toBe(false);
    await image.trigger('error');
    expect(first!.find('img').exists()).toBe(false);
  });

  it('keeps asking for the episodes until the catalog is complete', async () => {
    vi.useFakeTimers();
    try {
      const seasonEpisodes = vi
        .fn()
        .mockResolvedValueOnce(response([item(1)], { complete: false }))
        .mockResolvedValueOnce(response([item(1), item(2)], { complete: false }))
        .mockResolvedValueOnce(response([item(1), item(2), item(3)]));
      const { wrapper } = await mountWithApi(SeasonEpisodes, { seasonEpisodes } as never, {
        seasonId: 50,
        seriesId: 7,
        status: 'in_progress',
      });
      await flushPromises();
      expect(rows(wrapper)).toHaveLength(1);
      expect(wrapper.find('.partial').exists()).toBe(true);
      await vi.advanceTimersByTimeAsync(1600);
      expect(rows(wrapper)).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1600);
      expect(rows(wrapper)).toHaveLength(3);
      expect(wrapper.find('.partial').exists()).toBe(false);
      await vi.advanceTimersByTimeAsync(10000);
      expect(seasonEpisodes).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops asking after a bounded number of attempts', async () => {
    vi.useFakeTimers();
    try {
      const seasonEpisodes = vi.fn().mockResolvedValue(response([item(1)], { complete: false }));
      const { wrapper } = await mountWithApi(SeasonEpisodes, { seasonEpisodes } as never, {
        seasonId: 50,
        seriesId: 7,
        status: 'in_progress',
      });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(60000);
      expect(seasonEpisodes).toHaveBeenCalledTimes(21);
      expect(wrapper.find('.partial').text()).toContain('Reload');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an error when the episodes cannot be loaded', async () => {
    const mounted = await mountWithApi(
      SeasonEpisodes,
      { seasonEpisodes: vi.fn().mockRejectedValue(new Error('boom')) } as never,
      { seasonId: 50, seriesId: 7, status: 'planned' },
    );
    await flushPromises();
    expect(mounted.wrapper.find('.error').exists()).toBe(true);
  });
});
