import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { LibraryCache } from '../src/library/LibraryCache';
import { libraryCacheKey } from '../src/library/libraryCacheKey';
import { filtersFromQuery, filtersToMediaQuery } from '../src/logic/filterQuery';
import MediaListView from '../src/views/MediaListView.vue';
import { mountWithApi } from './mountWithApi';

const base = {
  subtitle: null,
  releaseDate: null,
  cover: null,
  banner: null,
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
    expect(wrapper.findAll('.grid .card')).toHaveLength(2);
    expect(wrapper.findAll('.rail .continue')).toHaveLength(1);
    expect(wrapper.find('.rail').text()).toContain('Dan Da Dan');

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

  it('links the welcome to the help page', async () => {
    const listMedia = vi.fn().mockResolvedValue({ total: 0, items: [] });
    const { wrapper, router } = await mountWithApi(MediaListView, { listMedia });
    await flushPromises();
    await wrapper.find('.welcome a').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('help');
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

  it('paints a cached page at once, without the loading text, and replaces it after revalidating', async () => {
    const heat = { ...base, type: 'movie', id: 1, title: 'Heat', status: 'completed' };
    const alien = { ...base, type: 'movie', id: 2, title: 'Alien', status: 'completed' };
    const cache = new LibraryCache();
    cache.set(filtersToMediaQuery(filtersFromQuery({})), { total: 1, items: [heat] } as never);
    let resolve: (value: unknown) => void = () => {};
    const listMedia = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    const { wrapper } = await mountWithApi(
      MediaListView,
      { listMedia },
      {},
      { [libraryCacheKey as symbol]: cache },
    );
    expect(wrapper.findAll('.grid .card')).toHaveLength(1);
    expect(wrapper.text()).toContain('Heat');
    expect(wrapper.text()).not.toContain('Loading');
    await flushPromises();
    expect(listMedia).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain('Loading');

    resolve({ total: 1, items: [alien] });
    await flushPromises();
    expect(wrapper.text()).toContain('Alien');
    expect(wrapper.text()).not.toContain('Heat');
    expect(cache.get(filtersToMediaQuery(filtersFromQuery({})))?.items).toEqual([alien]);
  });
});
