import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { AnyDetail } from '../src/api/AnyDetail';
import QuickActions from '../src/components/QuickActions.vue';
import { mountWithApi } from './mountWithApi';

const movie = {
  id: 4,
  title: 'Heat',
  status: 'in_progress',
  startedAt: '2026-01-01',
  finishedAt: null,
  rating: 3,
  review: null,
  rewatches: [],
  pendingReview: false,
} as unknown as AnyDetail;

enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

async function mountActions(patch: Mock, detail: AnyDetail = movie) {
  return mountWithApi(QuickActions, { patch: patch as never }, { collection: 'movies', detail });
}

describe('QuickActions', () => {
  it('saves a status change at once and confirms with a toast', async () => {
    const patch = vi.fn().mockResolvedValue({ ...movie, status: 'paused' });
    const { wrapper } = await mountActions(patch);
    await wrapper.find('select').setValue('paused');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { status: 'paused' }, {});
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(document.body.querySelector('[role="status"]')?.textContent).toContain(
      'Status set to Paused',
    );
  });

  it('undoes the change from the toast', async () => {
    const patch = vi.fn().mockResolvedValue(movie);
    const { wrapper } = await mountActions(patch);
    await wrapper.find('select').setValue('paused');
    await flushPromises();
    (document.body.querySelector('.undo') as HTMLElement).click();
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith(
      'movies',
      4,
      expect.objectContaining({ status: 'in_progress', startedAt: '2026-01-01' }),
      {},
    );
    expect(document.body.querySelector('[role="status"]')?.textContent).toContain('Change undone');
    expect(document.body.querySelector('.undo')).toBeNull();
  });

  it('rates with one tap on the picker and undoes to the previous rating', async () => {
    const patch = vi.fn().mockResolvedValue({ ...movie, rating: 6 });
    const { wrapper } = await mountActions(patch);
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false);
    await wrapper.find('button.rate').trigger('click');
    await wrapper.find('[data-rating="6"]').trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { rating: 6 }, {});
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false);
    expect(document.body.querySelector('[role="status"]')?.textContent).toContain('Rated Amazing');
    (document.body.querySelector('.undo') as HTMLElement).click();
    await flushPromises();
    expect(patch).toHaveBeenLastCalledWith('movies', 4, { rating: 3 }, {});
  });

  it('marks watched today with the local date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 12));
    const patch = vi.fn().mockResolvedValue({ ...movie, status: 'completed' });
    const { wrapper } = await mountActions(patch);
    const button = wrapper.findAll('button').find((b) => b.text() === 'Watched today');
    await button?.trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith(
      'movies',
      4,
      { finishedAt: '2026-11-16', status: 'completed', pendingReview: true },
      {},
    );
    expect(document.body.querySelector('[role="status"]')?.textContent).toContain(
      'Marked as watched today',
    );
  });

  it('shows the error and no toast when the save fails', async () => {
    const patch = vi.fn().mockRejectedValue(new Error('nope'));
    const { wrapper } = await mountActions(patch);
    await wrapper.find('select').setValue('paused');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(!!document.body.querySelector('.toast')).toBe(false);
  });

  it('drops the toast after a few seconds', async () => {
    vi.useFakeTimers();
    const patch = vi.fn().mockResolvedValue(movie);
    const { wrapper } = await mountActions(patch);
    await wrapper.find('select').setValue('paused');
    await flushPromises();
    expect(!!document.body.querySelector('.toast')).toBe(true);
    vi.advanceTimersByTime(6100);
    await flushPromises();
    expect(!!document.body.querySelector('.toast')).toBe(false);
  });
});
