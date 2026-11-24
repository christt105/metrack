import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RewatchList from '../src/components/RewatchList.vue';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { mountWithApi } from './mountWithApi';
import { en as messages } from '../src/i18n/messages/en';

enableAutoUnmount(afterEach);

const rewatches = [
  { startedAt: null, finishedAt: '2024-01-01' },
  { startedAt: '2025-02-01', finishedAt: '2025-02-03' },
  { startedAt: '2026-05-01', finishedAt: null },
];

async function mountList(
  patch = vi.fn().mockResolvedValue({}),
  completed = true,
  list = rewatches,
) {
  const mounted = await mountWithApi(
    RewatchList,
    { patch: patch as never },
    { collection: 'games', id: 20, rewatches: list, completed },
  );
  return { ...mounted, patch };
}

describe('RewatchList', () => {
  it('shows viewings newest first with their start and end', async () => {
    const { wrapper } = await mountList();
    const rows = wrapper.findAll('li').map((li) => li.find('.text').text());
    expect(rows).toEqual(['Watching since 1 May 2026', '1 Feb 2025 to 3 Feb 2025', '1 Jan 2024']);
  });

  it('edits a viewing inline and sends the full list', async () => {
    const { wrapper, patch } = await mountList();
    const row = wrapper.findAll('li')[2]!;
    await row.find('button').trigger('click');
    const inputs = row.findAll('input');
    await inputs[0]!.setValue('2023-12-30');
    await row.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('games', 20, {
      rewatches: [
        { startedAt: '2023-12-30', finishedAt: '2024-01-01' },
        rewatches[1],
        rewatches[2],
      ],
    });
    expect(wrapper.emitted('updated')).toHaveLength(1);
  });

  it('removes the open viewing and undoes it with a restore snapshot', async () => {
    const { wrapper, patch } = await mountList();
    await wrapper.findAll('li')[0]!.findAll('button')[1]!.trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith('games', 20, {
      rewatches: [rewatches[0], rewatches[1]],
    });
    (document.body.querySelector('.undo') as HTMLButtonElement).click();
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith('games', 20, { restore: true, rewatches });
  });

  it('adds a viewing with an optional start', async () => {
    const { wrapper, patch } = await mountList();
    const inputs = wrapper.find('form.add').findAll('input');
    await inputs[0]!.setValue('2026-06-01');
    await inputs[1]!.setValue('2026-06-05');
    await wrapper.find('form.add').trigger('submit');
    await flushPromises();
    const sent = patch.mock.calls[0]![2].rewatches;
    expect(sent).toContainEqual({ startedAt: '2026-06-01', finishedAt: '2026-06-05' });
    expect(sent).toHaveLength(4);
  });

  it('shows the server error', async () => {
    const patch = vi.fn().mockRejectedValue(new ApiRequestError('bad dates', 400, 'invalid_dates'));
    const { wrapper } = await mountList(patch);
    await wrapper.findAll('li')[1]!.findAll('button')[1]!.trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it('hides the add form for items that are not completed', async () => {
    const { wrapper } = await mountList(undefined, false);
    expect(wrapper.find('form.add').exists()).toBe(false);
  });

  it('explains that only completed items take viewings unless one is open', async () => {
    const open = await mountList(undefined, false);
    expect(open.wrapper.text()).not.toContain(messages.rewatches.onlyCompleted);
    open.wrapper.unmount();
    const closed = await mountList(undefined, false, rewatches.slice(0, 2));
    expect(closed.wrapper.text()).toContain(messages.rewatches.onlyCompleted);
  });
});
