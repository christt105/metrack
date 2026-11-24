import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import type { Season } from '@metrack/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RestartSeries from '../src/components/RestartSeries.vue';
import { mountWithApi } from './mountWithApi';

enableAutoUnmount(afterEach);

const season = (number: number, patch: Partial<Season> = {}): Season =>
  ({
    id: number + 10,
    seriesId: 1,
    number,
    status: 'completed',
    rewatches: [],
    wantsRewatch: false,
    ...patch,
  }) as Season;

describe('RestartSeries', () => {
  it('sets the intention to watch season 1 again on a finished series', async () => {
    const setSeasonRewatchIntent = vi.fn().mockResolvedValue({});
    const { wrapper } = await mountWithApi(RestartSeries, { setSeasonRewatchIntent } as never, {
      seasons: [season(2), season(1)],
    });
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(setSeasonRewatchIntent).toHaveBeenCalledWith(11, true);
    expect(wrapper.emitted('changed')).toHaveLength(1);
  });

  it('is hidden while a season is not completed or a rewatch is under way', async () => {
    const open = [{ startedAt: '2026-05-01', finishedAt: null }];
    for (const seasons of [
      [season(1), season(2, { status: 'in_progress' })],
      [season(1, { rewatches: open }), season(2)],
      [season(1, { wantsRewatch: true }), season(2)],
      [],
    ]) {
      const { wrapper } = await mountWithApi(RestartSeries, {} as never, { seasons });
      expect(wrapper.find('button').exists()).toBe(false);
    }
  });
});
