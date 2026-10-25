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
      expect.objectContaining({ q: 'dan', sort: 'title', order: 'asc' }),
    );
    vi.useRealTimers();
  });
});
