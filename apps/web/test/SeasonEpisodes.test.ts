import { enableAutoUnmount, flushPromises, type DOMWrapper } from '@vue/test-utils';
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
  skipped: false,
  viewings: [],
  filler: null,
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
  skippedCount: episodes.filter((e) => e.skipped).length,
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

const rows = (wrapper: { findAll: (s: string) => DOMWrapper<Element>[] }) =>
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

  it('flags filler and mixed episodes with a labelled icon and leaves canon ones plain', async () => {
    const { wrapper } = await mountList([
      item(1, { filler: 'filler' }),
      item(2, { filler: 'mixed' }),
      item(3, { filler: 'mangaCanon' }),
      item(4),
    ]);
    const marks = rows(wrapper).map((row) => row.find('.filler-mark'));
    expect(marks[0]!.attributes('aria-label')).toBe('Filler');
    expect(marks[0]!.attributes('title')).toBe('Filler');
    expect(marks[1]!.attributes('aria-label')).toBe('Mixed canon and filler');
    expect(marks[0]!.html()).not.toBe(marks[1]!.html());
    expect(marks[2]!.exists()).toBe(false);
    expect(marks[3]!.exists()).toBe(false);
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

  it('offers no undated mark buttons', async () => {
    const { wrapper } = await mountList([item(1), item(2)]);
    expect(wrapper.text()).not.toContain('without a date');
    await wrapper.find('li.episode button.text').trigger('click');
    expect(wrapper.text()).not.toContain('no date');
  });

  it('marks today every aired episode that is neither watched nor skipped', async () => {
    const episodes = [
      item(1, { watched: true, viewings: [viewing] }),
      item(2),
      item(3, { skipped: true }),
      item(4, { airDate: '2999-01-01' }),
      item(5),
    ];
    const update = vi.fn().mockResolvedValue({ ...response(episodes), tracking: tracking() });
    const { wrapper } = await mountList(episodes, { updateSeasonEpisodes: update });
    await wrapper.find('.actions button').trigger('click');
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', keys: ['k2', 'k5'], date: today });
  });

  it('adds a viewing of today to every aired episode that is not skipped when all are watched', async () => {
    const episodes = [
      item(1, { watched: true, viewings: [viewing] }),
      item(2, { skipped: true }),
      item(3, { watched: true, viewings: [] }),
    ];
    const update = vi.fn().mockResolvedValue({ ...response(episodes), tracking: tracking() });
    const { wrapper } = await mountList(episodes, { updateSeasonEpisodes: update });
    await wrapper.find('.actions button').trigger('click');
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', keys: ['k1', 'k3'], date: today });
  });

  it('shows skipped episodes dimmed with a label, and counts them in the progress', async () => {
    const { wrapper } = await mountList([
      item(1, { watched: true, viewings: [viewing] }),
      item(2, { skipped: true }),
      item(3, { skipped: true }),
    ]);
    const [first, second] = wrapper.findAll('li.episode');
    expect(first!.classes()).not.toContain('skipped');
    expect(second!.classes()).toContain('skipped');
    expect(second!.text()).toContain('Skipped');
    expect(wrapper.text()).toContain('3 of 3 episodes · 2 skipped');
  });

  it('skips from the expanded row and undoes it', async () => {
    const update = vi
      .fn()
      .mockResolvedValueOnce({
        ...response([item(1, { skipped: true }), item(2)]),
        tracking: tracking(),
      })
      .mockResolvedValueOnce({ ...response([item(1), item(2)]), tracking: tracking() });
    const { wrapper } = await mountList([item(1), item(2)], { updateSeasonEpisodes: update });
    await wrapper.find('li.episode button.text').trigger('click');
    const skip = wrapper
      .findAll('li.episode')[0]!
      .findAll('.body button')
      .find((b) => b.text() === 'Skip');
    await skip!.trigger('click');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, { op: 'skip', keys: ['k1'] });
    (document.body.querySelector('.toast .undo') as HTMLElement).click();
    await flushPromises();
    expect(update).toHaveBeenLastCalledWith(50, { op: 'unskip', keys: ['k1'] });
  });

  it('does not offer to skip an episode with a dated viewing, and unskips a skipped one', async () => {
    const update = vi.fn().mockResolvedValue({ ...response([item(1)]), tracking: tracking() });
    const { wrapper } = await mountList(
      [item(1, { watched: true, viewings: [viewing] }), item(2, { skipped: true })],
      { updateSeasonEpisodes: update },
    );
    const [dated, skipped] = wrapper.findAll('li.episode');
    await dated!.find('button.text').trigger('click');
    expect(dated!.findAll('.body button').map((b) => b.text())).not.toContain('Skip');
    await skipped!.find('button.text').trigger('click');
    const unskip = skipped!.findAll('.body button').find((b) => b.text() === 'Unskip');
    await unskip!.trigger('click');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, { op: 'unskip', keys: ['k2'] });
  });

  it('watching a skipped episode from its check marks it today', async () => {
    const update = vi.fn().mockResolvedValue({ ...response([item(1)]), tracking: tracking() });
    const { wrapper } = await mountList([item(1, { skipped: true })], {
      updateSeasonEpisodes: update,
    });
    await wrapper.find('li.episode button.check').trigger('click');
    await flushPromises();
    expect(update).toHaveBeenCalledWith(50, { op: 'mark', keys: ['k1'], date: today });
  });

  describe('with an open rewatch', () => {
    const start = '2026-05-01';
    const before = { startedAt: '2026-01-01', finishedAt: '2026-01-01' };
    const during = { startedAt: '2026-05-02', finishedAt: '2026-05-02' };
    const open = [{ startedAt: start, finishedAt: null }];
    const episodes = [
      item(1, { watched: true, viewings: [before, during] }),
      item(2, { watched: true, viewings: [before] }),
      item(3, { skipped: true }),
    ];

    async function mountRewatch(update: ReturnType<typeof vi.fn>) {
      const mounted = await mountWithApi(
        SeasonEpisodes,
        {
          seasonEpisodes: vi.fn().mockResolvedValue(response(episodes)),
          updateSeasonEpisodes: update,
        } as never,
        { seasonId: 50, seriesId: 7, status: 'completed', rewatches: open },
      );
      await flushPromises();
      return mounted;
    }

    it('shows the rewatch progress, counting skipped episodes as done', async () => {
      const { wrapper } = await mountRewatch(vi.fn());
      expect(wrapper.text()).toContain('Rewatch: 2 of 3');
      const [first, second] = wrapper.findAll('li.episode');
      expect(first!.find('button.check').classes()).toContain('on');
      expect(second!.find('button.check').classes()).not.toContain('on');
    });

    it('adds a viewing of today from an undone check and drops the rewatch viewings from a done one', async () => {
      const update = vi
        .fn()
        .mockResolvedValue({ ...response(episodes), tracking: tracking('completed') });
      const { wrapper } = await mountRewatch(update);
      const [first, second] = wrapper.findAll('li.episode');
      await second!.find('button.check').trigger('click');
      await flushPromises();
      expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', keys: ['k2'], date: today });
      await first!.find('button.check').trigger('click');
      await flushPromises();
      expect(update).toHaveBeenLastCalledWith(50, {
        op: 'setViewings',
        key: 'k1',
        viewings: [before],
      });
    });

    it('marks up to here and all with viewings of today, only for the episodes still to rewatch', async () => {
      const update = vi
        .fn()
        .mockResolvedValue({ ...response(episodes), tracking: tracking('completed') });
      const { wrapper } = await mountRewatch(update);
      await wrapper.find('.actions button').trigger('click');
      await flushPromises();
      expect(update).toHaveBeenLastCalledWith(50, { op: 'mark', keys: ['k2'], date: today });
    });
  });

  it('sets the intention to watch again from the Rewatch button of a completed season', async () => {
    const setSeasonRewatchIntent = vi.fn().mockResolvedValue({
      ...response([item(1)]),
      tracking: {
        status: 'completed',
        startedAt: null,
        finishedAt: null,
        rewatches: [],
        wantsRewatch: true,
      },
    });
    const mounted = await mountWithApi(
      SeasonEpisodes,
      {
        seasonEpisodes: vi.fn().mockResolvedValue(response([item(1)])),
        setSeasonRewatchIntent,
      } as never,
      { seasonId: 50, seriesId: 7, status: 'completed', rewatches: [] },
    );
    await flushPromises();
    const button = mounted.wrapper.findAll('.actions button').find((b) => b.text() === 'Rewatch');
    await button!.trigger('click');
    await flushPromises();
    expect(setSeasonRewatchIntent).toHaveBeenCalledWith(50, true);
    expect(mounted.wrapper.emitted('updated')).toHaveLength(1);
  });

  it('counts episodes as not yet done while the intention is set, and offers to cancel it', async () => {
    const setSeasonRewatchIntent = vi.fn().mockResolvedValue({
      ...response([item(1)]),
      tracking: {
        status: 'completed',
        startedAt: null,
        finishedAt: null,
        rewatches: [],
        wantsRewatch: false,
      },
    });
    const mounted = await mountWithApi(
      SeasonEpisodes,
      {
        seasonEpisodes: vi.fn().mockResolvedValue(response([item(1)])),
        setSeasonRewatchIntent,
      } as never,
      { seasonId: 50, seriesId: 7, status: 'completed', rewatches: [], wantsRewatch: true },
    );
    await flushPromises();
    const buttons = mounted.wrapper.findAll('.actions button').map((b) => b.text());
    expect(buttons).not.toContain('Rewatch');
    expect(buttons).toContain('Cancel rewatch');
    await mounted.wrapper
      .findAll('.actions button')
      .find((b) => b.text() === 'Cancel rewatch')!
      .trigger('click');
    await flushPromises();
    expect(setSeasonRewatchIntent).toHaveBeenCalledWith(50, false);
  });

  it('hides the Rewatch button while a rewatch is open or the season is not completed', async () => {
    const open = await mountWithApi(
      SeasonEpisodes,
      { seasonEpisodes: vi.fn().mockResolvedValue(response([item(1)])) } as never,
      {
        seasonId: 50,
        seriesId: 7,
        status: 'completed',
        rewatches: [{ startedAt: '2026-05-01', finishedAt: null }],
      },
    );
    await flushPromises();
    expect(open.wrapper.text()).not.toContain('Rewatch ');
    const { wrapper } = await mountList([item(1)]);
    expect(wrapper.findAll('.actions button').map((b) => b.text())).toEqual(['Watched today']);
  });

  it('starts a season in progress over, lists the abandoned pass and undoes it from the toast', async () => {
    const left = (date: string) => ({
      startedAt: date,
      finishedAt: date,
      abandonedAt: '2026-02-01',
    });
    const episodes = [
      item(1, { watched: true, viewings: [{ startedAt: '2026-01-01', finishedAt: '2026-01-01' }] }),
      item(2, { watched: true, viewings: [{ startedAt: '2026-01-02', finishedAt: '2026-01-02' }] }),
      item(3),
    ];
    const restarted = {
      ...response(
        [
          item(1, { viewings: [left('2026-01-01')] }),
          item(2, { viewings: [left('2026-01-02')] }),
          item(3),
        ],
        { watchedCount: 0 },
      ),
      tracking: tracking(),
    };
    const undone = { ...response(episodes), tracking: tracking() };
    const restartSeason = vi.fn().mockResolvedValue(restarted);
    const undoSeasonRestart = vi.fn().mockResolvedValue(undone);
    const mounted = await mountWithApi(
      SeasonEpisodes,
      {
        seasonEpisodes: vi.fn().mockResolvedValue(response(episodes)),
        restartSeason,
        undoSeasonRestart,
      } as never,
      { seasonId: 50, seriesId: 7, status: 'in_progress', rewatches: [] },
    );
    await flushPromises();
    const button = mounted.wrapper
      .findAll('.actions button')
      .find((b) => b.text() === 'Start over');
    await button!.trigger('click');
    await flushPromises();
    expect(restartSeason).toHaveBeenCalledWith(50);
    expect(mounted.wrapper.emitted('updated')).toHaveLength(1);
    expect(mounted.wrapper.find('.abandoned').text()).toContain(
      '2 of 3, from 1 Jan 2026 to 2 Jan 2026',
    );
    (document.body.querySelector('.toast .undo') as HTMLElement).click();
    await flushPromises();
    expect(undoSeasonRestart).toHaveBeenCalledWith(50);
    expect(mounted.wrapper.find('.abandoned').exists()).toBe(false);
  });

  it('only offers Start over for a season in progress with something watched', async () => {
    const none = await mountWithApi(
      SeasonEpisodes,
      { seasonEpisodes: vi.fn().mockResolvedValue(response([item(1)])) } as never,
      { seasonId: 50, seriesId: 7, status: 'in_progress', rewatches: [] },
    );
    await flushPromises();
    expect(none.wrapper.text()).not.toContain('Start over');
    const done = await mountWithApi(
      SeasonEpisodes,
      {
        seasonEpisodes: vi
          .fn()
          .mockResolvedValue(response([item(1, { watched: true, viewings: [viewing] })])),
      } as never,
      { seasonId: 50, seriesId: 7, status: 'completed', rewatches: [] },
    );
    await flushPromises();
    expect(done.wrapper.text()).not.toContain('Start over');
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
