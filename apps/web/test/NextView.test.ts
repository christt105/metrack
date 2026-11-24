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
  const updateSeasonEpisodes = vi.fn().mockResolvedValue({ tracking: { status: 'in_progress' } });
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
    finish({ tracking: { status: 'in_progress' } });
    await flushPromises();
    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('shows the air date without buttons when the episode has not aired', async () => {
    const waiting = row(1, { availability: 'airs', airsOn: '2030-11-28' });
    const { wrapper } = await mountNext([waiting]);
    const item = wrapper.find('[data-series="1"]');
    expect(item.text()).toContain('S3 · E7 airs on 28 Nov 2030');
    expect(item.find('.mark').exists()).toBe(false);
    expect(item.find('.skip').exists()).toBe(false);
  });

  it('shows the premiere date of a season not aired yet', async () => {
    const waiting = row(1, { availability: 'premieres', airsOn: '2030-11-28' });
    const { wrapper } = await mountNext([waiting]);
    expect(wrapper.find('[data-series="1"]').text()).toContain('S3 premieres on 28 Nov 2030');
    expect(wrapper.find('.mark').exists()).toBe(false);
    expect(wrapper.find('.skip').exists()).toBe(false);
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

  it('hides the skip button on a rewatch row', async () => {
    const { wrapper } = await mountNext([
      row(1, {
        labels: ['rewatch'],
        progress: { watched: 2, total: 12, skipped: 0, rewatch: true },
      }),
      row(2),
    ]);
    expect(wrapper.find('[data-series="1"] .skip').exists()).toBe(false);
    expect(wrapper.find('[data-series="1"] .mark').exists()).toBe(true);
    expect(wrapper.find('[data-series="2"] .skip').exists()).toBe(true);
  });

  it('says the season is completed when the mark finishes it, and the row becomes the new season', async () => {
    const fresh = row(1, {
      season: { ...row(1).season, id: 11, number: 4 },
      episode: { ...row(1).episode, number: 1, key: 'n1' },
      labels: ['newSeason'],
    });
    const nextEpisodes = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row(1)] })
      .mockResolvedValueOnce({ rows: [fresh] });
    const updateSeasonEpisodes = vi.fn().mockResolvedValue({ tracking: { status: 'completed' } });
    const { wrapper } = await mountNext([], { nextEpisodes, updateSeasonEpisodes });
    await markButton(wrapper, 1).trigger('click');
    await flushPromises();
    const item = wrapper.find('[data-series="1"]');
    expect(item.text()).toContain('S4 · E1');
    expect(item.text()).toContain('New season');
    expect(document.body.textContent).toContain('Episode marked. Season 3 completed');
  });

  it('does not announce a completed season for a plain mark', async () => {
    const { wrapper } = await mountNext([row(1)]);
    await markButton(wrapper, 1).trigger('click');
    await flushPromises();
    expect(document.body.textContent).not.toContain('completed');
  });
});

describe('the row menu', () => {
  const trigger = (wrapper: VueWrapper, id: number) =>
    wrapper.find(`[data-series="${id}"] .trigger`);

  it('opens with the remove action, closes with Escape and gives the focus back', async () => {
    const { wrapper } = await mountNext([row(1)]);
    const button = trigger(wrapper, 1);
    expect(button.attributes('aria-haspopup')).toBe('menu');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.attributes('aria-label')).toBe('More actions for Series 1');
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');
    const items = wrapper.findAll('[role="menuitem"]');
    expect(items.map((item) => item.text())).toEqual(['Start over', 'Remove from Up next']);
    await wrapper.find('.menu').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('starts the season over from the menu and takes it back from the toast', async () => {
    const nextEpisodes = vi.fn().mockResolvedValue({ rows: [row(1)] });
    const restartSeason = vi.fn().mockResolvedValue({});
    const undoSeasonRestart = vi.fn().mockResolvedValue({});
    const { wrapper } = await mountNext([], { nextEpisodes, restartSeason, undoSeasonRestart });
    await trigger(wrapper, 1).trigger('click');
    await wrapper.findAll('[role="menuitem"]')[0]!.trigger('click');
    await flushPromises();
    expect(restartSeason).toHaveBeenCalledWith(row(1).season.id);
    expect(document.body.textContent).toContain('Season started over from the first episode');
    (document.body.querySelector('.toast .undo') as HTMLButtonElement).click();
    await flushPromises();
    expect(undoSeasonRestart).toHaveBeenCalledWith(row(1).season.id);
  });

  it('has no Start over entry for a row with nothing watched', async () => {
    const { wrapper } = await mountNext([
      row(1, { progress: { watched: 0, total: 12, skipped: 0, rewatch: false } }),
    ]);
    await trigger(wrapper, 1).trigger('click');
    expect(wrapper.findAll('[role="menuitem"]').map((item) => item.text())).toEqual([
      'Remove from Up next',
    ]);
  });

  it('removes the series, shows a toast and puts it back on undo', async () => {
    const nextEpisodes = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row(1), row(2)] })
      .mockResolvedValueOnce({ rows: [row(2), row(1)] });
    const hideFromNext = vi.fn().mockResolvedValue(undefined);
    const showInNext = vi.fn().mockResolvedValue(undefined);
    const { wrapper, updateSeasonEpisodes } = await mountNext([], {
      nextEpisodes,
      hideFromNext,
      showInNext,
    });
    await trigger(wrapper, 1).trigger('click');
    await wrapper.findAll('[role="menuitem"]').at(-1)!.trigger('click');
    await flushPromises();
    expect(hideFromNext).toHaveBeenCalledWith(1);
    expect(wrapper.findAll('li.next').map((li) => li.attributes('data-series'))).toEqual(['2']);
    expect(document.body.textContent).toContain('Series 1 removed from Up next');

    (document.body.querySelector('.toast .undo') as HTMLButtonElement).click();
    await flushPromises();
    expect(showInNext).toHaveBeenCalledWith(1);
    expect(updateSeasonEpisodes).not.toHaveBeenCalled();
    expect(wrapper.findAll('li.next').map((li) => li.attributes('data-series'))).toEqual([
      '2',
      '1',
    ]);
  });

  it('keeps the row and shows the error when removing fails', async () => {
    const hideFromNext = vi.fn().mockRejectedValue(new Error('boom'));
    const { wrapper } = await mountNext([row(1)], { hideFromNext });
    await trigger(wrapper, 1).trigger('click');
    await wrapper.findAll('[role="menuitem"]').at(-1)!.trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.findAll('li.next')).toHaveLength(1);
  });

  it('is offered on a row that is waiting for its air date', async () => {
    const { wrapper } = await mountNext([
      row(1, { availability: 'premieres', airsOn: '2030-11-28' }),
    ]);
    expect(trigger(wrapper, 1).exists()).toBe(true);
  });
});
