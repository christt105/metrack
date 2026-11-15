import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MediaListView from '../src/views/MediaListView.vue';
import { mountWithApi } from './mountWithApi';

const base = {
  subtitle: null,
  releaseDate: null,
  cover: null,
  startedAt: null,
  finishedAt: null,
  seriesId: null,
  seriesTitle: null,
  seasonCount: null,
  status: null,
  rating: null,
};

describe('MediaListView', () => {
  it('renders a single-season series as one card and searches with the typed text', async () => {
    const listMedia = vi.fn().mockResolvedValue({
      total: 3,
      items: [
        { ...base, type: 'series', id: 2, title: 'Dan Da Dan', seasonCount: 1 },
        {
          ...base,
          type: 'season',
          id: 20,
          title: 'Season 1',
          seriesId: 2,
          seriesTitle: 'Dan Da Dan',
          status: 'in_progress',
        },
        { ...base, type: 'movie', id: 1, title: 'Heat', status: 'completed' },
      ],
    });
    vi.useFakeTimers();
    const { wrapper } = await mountWithApi(MediaListView, { listMedia });
    await vi.advanceTimersByTimeAsync(0);
    await flushPromises();
    expect(wrapper.findAll('.card')).toHaveLength(2);
    expect(wrapper.text()).toContain('In progress');

    await wrapper.find('input[type="search"]').setValue('dan');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(listMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'dan', sort: 'recent', order: 'desc' }),
    );
    vi.useRealTimers();
  });
});

describe('MediaListView empty states', () => {
  it('welcomes a user whose library is empty and links to adding a title', async () => {
    const listMedia = vi.fn().mockResolvedValue({ total: 0, items: [] });
    const { wrapper, router } = await mountWithApi(MediaListView, { listMedia });
    await flushPromises();
    expect(wrapper.text()).toContain('Welcome to metrack');
    expect(wrapper.text()).not.toContain('Nothing matches these filters.');
    await wrapper.find('button.primary').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('search');
  });

  it('keeps the filters and the plain message when filters match nothing', async () => {
    const listMedia = vi
      .fn()
      .mockResolvedValueOnce({
        total: 1,
        items: [{ ...base, type: 'movie', id: 1, title: 'Heat', status: 'completed' }],
      })
      .mockResolvedValue({ total: 0, items: [] });
    const { wrapper } = await mountWithApi(MediaListView, { listMedia });
    await flushPromises();
    vi.useFakeTimers();
    await wrapper.find('input[type="search"]').setValue('zzz');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    vi.useRealTimers();
    expect(wrapper.text()).toContain('Nothing matches these filters.');
    expect(wrapper.text()).not.toContain('Welcome to metrack');
    expect(wrapper.find('input[type="search"]').exists()).toBe(true);
  });
});
