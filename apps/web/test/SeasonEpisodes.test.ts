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
  number,
  title: `Title ${number}`,
  airDate: '2020-01-01',
  runtime: 24,
  overview: `About ${number}`,
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
  episodeCount: episodes.length,
  watchedCount: episodes.filter((e) => e.watched).length,
  episodes,
  catalogMismatch: null,
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
    expect(update).toHaveBeenCalledWith(50, { op: 'mark', numbers: [1], date: today });
    expect(wrapper.emitted('updated')).toHaveLength(1);
    const toast = document.body.querySelector('.toast')!;
    expect(toast.textContent).toContain('Episode marked');
    (toast.querySelector('.undo') as HTMLElement).click();
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'unmark', numbers: [1] });
  });

  it('unmarks a watched episode and undo restores its viewings', async () => {
    const update = vi.fn().mockResolvedValue({ ...response([item(1)]), tracking: tracking() });
    const { wrapper } = await mountList([item(1, { watched: true, viewings: [viewing] })], {
      updateSeasonEpisodes: update,
    });
    await wrapper.find('li.episode button.check').trigger('click');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, { op: 'unmark', numbers: [1] });
    (document.body.querySelector('.toast .undo') as HTMLElement).click();
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, {
      op: 'setViewings',
      number: 1,
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
    expect(update).toHaveBeenCalledWith(50, { op: 'mark', numbers: [2, 3], date: today });
  });

  it('marks every aired episode, with or without a date', async () => {
    const episodes = [item(1), item(2), item(3, { airDate: '2999-01-01' })];
    const update = vi.fn().mockResolvedValue({ ...response(episodes), tracking: tracking() });
    const { wrapper } = await mountList(episodes, { updateSeasonEpisodes: update });
    const [all, undated] = wrapper.findAll('.actions button');
    await all!.trigger('click');
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', numbers: [1, 2], date: today });
    await undated!.trigger('click');
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', numbers: [1, 2], date: null });
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
      number: 1,
      viewings: [viewing, { startedAt: null, finishedAt: '2026-03-03' }],
    });
  });

  it('points to the episode group chooser on a catalog mismatch', async () => {
    const { wrapper } = await mountList(
      [item(1, { title: null })],
      {},
      {
        source: 'numbers',
        catalogMismatch: { catalogEpisodes: 25 },
      },
    );
    const note = wrapper.find('.mismatch');
    expect(note.text()).toContain('lists 25 episodes');
    expect(note.find('a').attributes('href')).toBe('/series/7');
    expect(rows(wrapper)).toHaveLength(1);
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
