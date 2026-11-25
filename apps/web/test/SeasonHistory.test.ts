import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import type { SeasonEpisodeItem, SeasonEpisodesResponse } from '@metrack/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SeasonEpisodes from '../src/components/SeasonEpisodes.vue';
import { mountWithApi } from './mountWithApi';
import { pickDate } from './pickDate';

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 20));
});
afterEach(() => vi.useRealTimers());

const day = (date: string, abandonedAt?: string) => ({
  startedAt: date,
  finishedAt: date,
  ...(abandonedAt ? { abandonedAt } : {}),
});
const item = (number: number, viewings: SeasonEpisodeItem['viewings']): SeasonEpisodeItem => ({
  key: `k${number}`,
  number,
  tmdbId: number,
  title: `Title ${number}`,
  airDate: '2020-01-01',
  runtime: null,
  overview: null,
  stillPath: null,
  watched: viewings.some((v) => v.abandonedAt === undefined),
  skipped: false,
  viewings,
  filler: null,
});
const response = (
  episodes: SeasonEpisodeItem[],
): SeasonEpisodesResponse & { tracking: object } => ({
  seasonId: 50,
  source: 'tmdb',
  fetchedAt: '2026-01-01',
  complete: true,
  datesDerived: false,
  episodeCount: episodes.length,
  watchedCount: episodes.filter((e) => e.watched).length,
  skippedCount: 0,
  episodes,
  tracking: { status: 'completed', startedAt: null, finishedAt: null, rewatches: [] },
});

const episodes = [
  item(1, [day('2026-01-01', '2026-02-01'), day('2026-03-01'), day('2026-04-01')]),
  item(2, [day('2026-03-02')]),
];

async function mountHistory(api: Record<string, unknown> = {}, props: object = {}) {
  const mounted = await mountWithApi(
    SeasonEpisodes,
    { seasonEpisodes: vi.fn().mockResolvedValue(response(episodes)), ...api } as never,
    { seasonId: 50, seriesId: 7, status: 'completed', rewatches: [], wantsRewatch: true, ...props },
  );
  await flushPromises();
  return mounted;
}

describe('SeasonHistory', () => {
  it('lists the first time, the rewatch and the pass left behind with their episodes', async () => {
    const { wrapper } = await mountHistory();
    const passes = wrapper.findAll('.history details.pass');
    expect(passes.map((p) => p.find('.name').text())).toEqual([
      'First time',
      'Rewatch 1',
      'Left behind on 1 Feb 2026',
    ]);
    expect(passes[0]!.findAll('li')).toHaveLength(2);
    expect(passes[0]!.text()).toContain('1. Title 1');
    expect(passes[1]!.findAll('li')).toHaveLength(1);
  });

  it('asks before deleting a pass and undoes it by restoring the viewings', async () => {
    const removeSeasonPass = vi.fn().mockResolvedValue(response([item(1, []), item(2, [])]));
    const updateSeasonEpisodes = vi.fn().mockResolvedValue(response(episodes));
    const { wrapper } = await mountHistory({ removeSeasonPass, updateSeasonEpisodes });
    const second = wrapper.findAll('.history details.pass')[1]!;
    await second.find('.pass-actions button.danger').trigger('click');
    expect(removeSeasonPass).not.toHaveBeenCalled();
    expect(second.find('[role="alertdialog"]').text()).toContain('Delete "Rewatch 1"?');
    await second.find('[role="alertdialog"] button.danger').trigger('click');
    await flushPromises();
    expect(removeSeasonPass).toHaveBeenCalledWith(50, 2);
    (document.body.querySelector('.toast .undo') as HTMLElement).click();
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenCalledWith(50, {
      op: 'restoreViewings',
      episodes: [{ key: 'k1', viewings: episodes[0]!.viewings }],
    });
  });

  it('takes back the start over of the day it was left on', async () => {
    const undoSeasonRestart = vi.fn().mockResolvedValue(response(episodes));
    const { wrapper } = await mountHistory({ undoSeasonRestart });
    const left = wrapper.find('.history details.left');
    await left.find('.pass-actions button').trigger('click');
    await flushPromises();
    expect(undoSeasonRestart).toHaveBeenCalledWith(50, '2026-02-01');
  });

  it('edits the dates of one viewing with a single date', async () => {
    const updateSeasonEpisodes = vi.fn().mockResolvedValue(response(episodes));
    const { wrapper } = await mountHistory({ updateSeasonEpisodes });
    const row = wrapper.findAll('.history details.pass')[0]!.findAll('li')[1]!;
    await row.find('button').trigger('click');
    expect(row.findAll('input.date-trigger')).toHaveLength(1);
    await pickDate(row.get('input.date-trigger'), '2026-03-09');
    await row.find('form').trigger('submit');
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenCalledWith(50, {
      op: 'setViewings',
      key: 'k2',
      viewings: [day('2026-03-09')],
    });
  });

  it('reveals the start only on request', async () => {
    const updateSeasonEpisodes = vi.fn().mockResolvedValue(response(episodes));
    const { wrapper } = await mountHistory({ updateSeasonEpisodes });
    const row = wrapper.findAll('.history details.pass')[0]!.findAll('li')[1]!;
    await row.find('button').trigger('click');
    await row.find('input[type="checkbox"]').setValue(true);
    const [end, start] = row.findAll('input.date-trigger');
    expect(row.findAll('input.date-trigger')).toHaveLength(2);
    await pickDate(end!, '2026-03-09');
    await pickDate(start!, '2026-03-08');
    await row.find('form').trigger('submit');
    await flushPromises();
    expect(updateSeasonEpisodes).toHaveBeenCalledWith(50, {
      op: 'setViewings',
      key: 'k2',
      viewings: [{ startedAt: '2026-03-08', finishedAt: '2026-03-09' }],
    });
  });

  it('shows the server message when an edit is refused', async () => {
    const { ApiRequestError } = await import('../src/api/ApiRequestError');
    const updateSeasonEpisodes = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('raw', 400, 'future_date'));
    const { wrapper } = await mountHistory({ updateSeasonEpisodes });
    const row = wrapper.findAll('.history details.pass')[0]!.findAll('li')[1]!;
    await row.find('button').trigger('click');
    await row.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('A viewing cannot have a date in the future.');
  });

  it('removes the rewatch intention and puts it back on undo', async () => {
    const setSeasonRewatchIntent = vi.fn().mockResolvedValue(response(episodes));
    const { wrapper } = await mountHistory({ setSeasonRewatchIntent });
    await wrapper.find('.history .intent button').trigger('click');
    await flushPromises();
    expect(setSeasonRewatchIntent).toHaveBeenLastCalledWith(50, false);
    (document.body.querySelector('.toast .undo') as HTMLElement).click();
    await flushPromises();
    expect(setSeasonRewatchIntent).toHaveBeenLastCalledWith(50, true);
  });
});
