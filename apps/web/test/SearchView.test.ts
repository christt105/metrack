import { fakeApi } from './fakeApi';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../src/api/ApiRequestError';
import SearchView from '../src/views/SearchView.vue';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import { mountWithApi } from './mountWithApi';

describe('SearchView', () => {
  it('explains a 501 and offers the manual form for games', async () => {
    const search = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('not configured', 501, 'provider_not_configured'));
    const { wrapper } = await mountWithApi(SearchView, { library: { search } });
    const gameChip = wrapper.findAll('.types button').find((b) => b.text() === 'Game');
    await gameChip?.trigger('click');
    await wrapper.find('input[type="search"]').setValue('Hades');
    await wrapper.find('form[role="search"]').trigger('submit');
    await flushPromises();
    expect(search).toHaveBeenCalledWith('videogame', 'Hades', undefined);
    expect(wrapper.find('[role="alert"]').text()).toContain('not set up');
    expect(wrapper.text()).toContain('Add by hand');
  });

  it('offers add-by-hand after an empty search only to users who may', async () => {
    const search = vi.fn().mockResolvedValue({ results: [] });
    const run = async (role: 'normal' | 'trusted') => {
      const session = new Session(fakeApi({}));
      session.signedIn({ id: 2, name: 'U', email: null, role });
      const { wrapper } = await mountWithApi(
        SearchView,
        { library: { search } },
        {},
        { [sessionKey as symbol]: session },
      );
      await wrapper
        .findAll('.types button')
        .find((b) => b.text() === 'Game')
        ?.trigger('click');
      await wrapper.find('input[type="search"]').setValue('Hades');
      await wrapper.find('form[role="search"]').trigger('submit');
      await flushPromises();
      return wrapper.find('[data-test="manual-hint"]').text();
    };
    expect(await run('trusted')).toContain('add the title by hand');
    expect(await run('normal')).toContain('Ask the owner');
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
      library: {
        search: vi.fn().mockResolvedValue({ results: [result] }),
        addTitle: vi.fn().mockResolvedValue({ type: 'movie', id: 12 }),
      },
    };
    const { wrapper, router } = await mountWithApi(SearchView, api);
    await wrapper.find('input[type="search"]').setValue('heat');
    await wrapper.find('form[role="search"]').trigger('submit');
    await flushPromises();
    await wrapper.find('button.primary.small').trigger('click');
    await flushPromises();
    expect(api.library.addTitle).toHaveBeenCalledWith({ type: 'movie', externalId: '9' });
    expect(router.currentRoute.value.path).toBe('/movies/12');
  });
});
