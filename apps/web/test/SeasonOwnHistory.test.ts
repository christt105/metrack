import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import type { Season } from '@metrack/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SeasonOwnHistory from '../src/components/SeasonOwnHistory.vue';
import { mountWithApi } from './mountWithApi';
import { pickDate } from './pickDate';

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 20));
});
afterEach(() => vi.useRealTimers());

const season = {
  id: 20,
  status: 'completed',
  startedAt: '2026-01-01',
  finishedAt: '2026-01-10',
  rewatches: [{ startedAt: '2026-02-01', finishedAt: '2026-02-01' }],
} as unknown as Season;

describe('SeasonOwnHistory', () => {
  it('edits the dates of the season with one date and undoes it with a restore', async () => {
    const patch = vi.fn().mockResolvedValue({});
    const { wrapper } = await mountWithApi(SeasonOwnHistory, { patch: patch as never }, { season });
    const row = wrapper.find('.dates li');
    await row.find('button').trigger('click');
    expect(row.findAll('input.date-trigger')).toHaveLength(2);
    await pickDate(row.get('input.date-trigger'), '2026-01-11');
    await row.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith('seasons', 20, {
      startedAt: '2026-01-01',
      finishedAt: '2026-01-11',
    });
    expect(wrapper.emitted('updated')).toHaveLength(1);
    (document.body.querySelector('.toast .undo') as HTMLElement).click();
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith('seasons', 20, {
      startedAt: '2026-01-01',
      finishedAt: '2026-01-10',
      restore: true,
    });
  });

  it('lists the rewatches through the rewatch list and adds one with a single date', async () => {
    const patch = vi.fn().mockResolvedValue({});
    const { wrapper } = await mountWithApi(SeasonOwnHistory, { patch: patch as never }, { season });
    const add = wrapper.find('form.add');
    expect(add.findAll('input.date-trigger')).toHaveLength(1);
    await pickDate(add.get('input.date-trigger'), '2026-03-01');
    await add.trigger('submit');
    await flushPromises();
    expect(patch.mock.calls[0]![2].rewatches).toContainEqual({
      startedAt: '2026-03-01',
      finishedAt: '2026-03-01',
    });
  });
});
