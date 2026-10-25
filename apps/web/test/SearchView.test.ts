import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../src/api/ApiRequestError';
import SearchView from '../src/views/SearchView.vue';
import { mountWithApi } from './mountWithApi';

describe('SearchView', () => {
  it('explains a 501 and offers the manual form for games', async () => {
    const search = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('not configured', 501, 'provider_not_configured'));
    const { wrapper } = await mountWithApi(SearchView, { search });
    await wrapper.find('select').setValue('videogame');
    await wrapper.find('input[type="search"]').setValue('Hades');
    await wrapper.find('form[role="search"]').trigger('submit');
    await flushPromises();
    expect(search).toHaveBeenCalledWith('videogame', 'Hades', undefined);
    expect(wrapper.find('[role="alert"]').text()).toContain('not set up');
    expect(wrapper.text()).toContain('Add by hand');
  });

  it('adds a result and goes to its page', async () => {
    const result = {
      type: 'movie',
      provider: 'tmdb',
      externalId: '9',
      title: 'Heat',
      originalTitle: null,
      year: 1995,
      overview: null,
      posterUrl: null,
      existingId: null,
    };
    const api = {
      search: vi.fn().mockResolvedValue({ results: [result] }),
      addTitle: vi.fn().mockResolvedValue({ type: 'movie', id: 12 }),
    };
    const { wrapper, router } = await mountWithApi(SearchView, api);
    await wrapper.find('input[type="search"]').setValue('heat');
    await wrapper.find('form[role="search"]').trigger('submit');
    await flushPromises();
    await wrapper.find('button.primary.small').trigger('click');
    await flushPromises();
    expect(api.addTitle).toHaveBeenCalledWith({ type: 'movie', externalId: '9' });
    expect(router.currentRoute.value.path).toBe('/movies/12');
  });
});
