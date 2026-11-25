import { flushPromises } from '@vue/test-utils';
import { RouterView } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnyDetail } from '../src/api/AnyDetail';
import type { ApiClient } from '../src/api/ApiClient';
import { mountWithApi } from './mountWithApi';
import { pickDate } from './pickDate';

const movie = {
  id: 4,
  tmdbId: 10,
  jellyfinId: null,
  title: 'Heat',
  originalTitle: null,
  releaseDate: null,
  overview: null,
  genres: [],
  cast: [],
  director: null,
  follow: false,
  status: 'completed',
  startedAt: '2026-01-01',
  finishedAt: '2026-01-02',
  rating: 5,
  review: null,
  rewatches: [],
  pendingReview: false,
  note: null,
  slug: null,
  tags: [],
  cover: null,
  banner: null,
  editedFields: ['title'],
  fetchedAt: null,
} as unknown as AnyDetail;

const series = {
  id: 9,
  tmdbId: 1,
  tvdbId: null,
  jellyfinId: null,
  title: 'The Wire',
  originalTitle: null,
  firstAirDate: null,
  genres: [],
  cast: [],
  overview: null,
  review: null,
  note: null,
  slug: null,
  tags: [],
  seasons: [],
  editedFields: [],
} as unknown as AnyDetail;

const EMPTY_EPISODES = {
  seasonId: 30,
  source: 'tmdb',
  fetchedAt: null,
  complete: true,
  episodeCount: 0,
  watchedCount: 0,
  episodes: [],
};

const mounted: { unmount: () => void }[] = [];

async function open(api: Partial<ApiClient>, path = '/movies/4/edit', from = '/movies/4') {
  const result = await mountWithApi(RouterView, api);
  mounted.push(result.wrapper);
  await result.router.push(from);
  await result.router.push(path);
  await flushPromises();
  return result;
}

const footerButtons = (wrapper: Awaited<ReturnType<typeof open>>['wrapper']) => ({
  save: wrapper.find('.bar button.primary'),
  count: wrapper.find('.bar__count'),
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

describe('MediaEditView', () => {
  it('renders the sections in order', async () => {
    const { wrapper } = await open({ getDetail: vi.fn().mockResolvedValue(movie) });
    const legends = wrapper.findAll('fieldset legend').map((l) => l.text());
    expect(legends).toEqual(['Your tracking', 'Your notes', 'Title details', 'Identifiers']);
    expect(wrapper.find('h1').text()).toBe('Edit Heat');
    expect(wrapper.find('details').exists()).toBe(false);
  });

  it('has no tracking section for a series and keeps its review under notes', async () => {
    const { wrapper } = await open(
      { getDetail: vi.fn().mockResolvedValue(series) },
      '/series/9/edit',
      '/series/9',
    );
    const legends = wrapper.findAll('fieldset legend').map((l) => l.text());
    expect(legends).toEqual(['Your notes', 'Title details', 'Identifiers']);
    expect(wrapper.find('fieldset[data-section="notes"] #field-review').exists()).toBe(true);
    expect(wrapper.find('#field-pendingReview').exists()).toBe(false);
  });

  it('offers only valid status transitions', async () => {
    const { wrapper } = await open({ getDetail: vi.fn().mockResolvedValue(movie) });
    const options = wrapper.findAll('#field-status option').map((o) => o.attributes('value'));
    expect(options).toEqual(['in_progress', 'completed']);
  });

  it('disables Save until something changes and counts the changes', async () => {
    const { wrapper } = await open({ getDetail: vi.fn().mockResolvedValue(movie) });
    const { save, count } = footerButtons(wrapper);
    expect(save.attributes('disabled')).toBeDefined();
    expect(count.text()).toBe('No changes');
    await wrapper.find('#field-rating [data-rating="7"]').trigger('click');
    expect(count.text()).toBe('1 change');
    await wrapper.find('#field-slug').setValue('heat');
    expect(count.text()).toBe('2 changes');
    expect(save.attributes('disabled')).toBeUndefined();
  });

  it('sends only the changed fields and goes back to the detail page', async () => {
    const patch = vi.fn().mockResolvedValue(movie);
    const { wrapper, router } = await open({
      getDetail: vi.fn().mockResolvedValue(movie),
      patch,
    });
    Object.defineProperty(router.options.history, 'state', { value: { back: '/movies/4' } });
    const back = vi.spyOn(router, 'back').mockImplementation(() => undefined);
    await wrapper.find('#field-rating [data-rating="7"]').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { rating: 7 }, {});
    expect(back).toHaveBeenCalled();
  });

  it('replaces the edit entry when it was opened directly', async () => {
    const { wrapper, router } = await open(
      { getDetail: vi.fn().mockResolvedValue(movie), patch: vi.fn().mockResolvedValue(movie) },
      '/movies/4/edit',
      '/',
    );
    await wrapper.find('#field-slug').setValue('heat');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/movies/4');
  });

  it('sends the pending review checkbox as pendingReview', async () => {
    const pending = { ...movie, pendingReview: true } as AnyDetail;
    const patch = vi.fn().mockResolvedValue(movie);
    const { wrapper } = await open({ getDetail: vi.fn().mockResolvedValue(pending), patch });
    const box = wrapper.find('#field-pendingReview');
    expect((box.element as HTMLInputElement).checked).toBe(true);
    await box.setValue(false);
    expect(footerButtons(wrapper).count.text()).toBe('1 change');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { pendingReview: false }, {});
  });

  it('releases an edited field only when saving, and can undo it', async () => {
    const unmarkEdited = vi.fn().mockResolvedValue(undefined);
    const patch = vi.fn();
    const { wrapper } = await open({
      getDetail: vi.fn().mockResolvedValue(movie),
      unmarkEdited,
      patch,
    });
    const toggle = wrapper.find('.field .below button');
    await toggle.trigger('click');
    expect(unmarkEdited).not.toHaveBeenCalled();
    expect(footerButtons(wrapper).count.text()).toBe('1 change');
    await toggle.trigger('click');
    expect(footerButtons(wrapper).count.text()).toBe('No changes');
    await toggle.trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).not.toHaveBeenCalled();
    expect(unmarkEdited).toHaveBeenCalledWith('movies', 4, 'title');
  });

  it('shows a field problem and does not save', async () => {
    const patch = vi.fn();
    const { wrapper } = await open({ getDetail: vi.fn().mockResolvedValue(movie), patch });
    await wrapper.find('#field-title').setValue('');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).not.toHaveBeenCalled();
    expect(wrapper.find('.problem').exists()).toBe(true);
  });

  it('asks before leaving with unsaved changes', async () => {
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirm);
    const { wrapper, router } = await open({ getDetail: vi.fn().mockResolvedValue(movie) });
    await wrapper.find('#field-slug').setValue('heat');
    await router.push('/watchlist');
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('unsaved changes'));
    expect(router.currentRoute.value.path).toBe('/movies/4/edit');
    confirm.mockReturnValue(true);
    await router.push('/watchlist');
    expect(router.currentRoute.value.path).toBe('/watchlist');
  });

  it('does not ask when nothing changed, nor after saving', async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    const { wrapper, router } = await open({
      getDetail: vi.fn().mockResolvedValue(movie),
      patch: vi.fn().mockResolvedValue(movie),
    });
    await wrapper.find('#field-slug').setValue('heat');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(confirm).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/movies/4');
  });

  it('warns on page unload only while dirty', async () => {
    const { wrapper } = await open({ getDetail: vi.fn().mockResolvedValue(movie) });
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await wrapper.find('#field-slug').setValue('heat');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    wrapper.unmount();
    const gone = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(gone);
    expect(gone.defaultPrevented).toBe(false);
  });

  describe('season dates', () => {
    const season = {
      id: 30,
      seriesId: 9,
      number: 1,
      status: 'completed',
      startedAt: '2026-01-01',
      finishedAt: '2026-01-09',
      rewatches: [],
      editedFields: [],
    } as unknown as AnyDetail;

    it('shows the dates read-only with a hint when they come from the episodes', async () => {
      const { wrapper } = await open(
        {
          getDetail: vi.fn().mockResolvedValue(season),
          seasonEpisodes: vi.fn().mockResolvedValue({ ...EMPTY_EPISODES, datesDerived: true }),
        },
        '/seasons/30/edit',
        '/seasons/30',
      );
      const started = wrapper.find('#field-startedAt');
      expect((started.element as HTMLInputElement).disabled).toBe(true);
      expect((wrapper.find('#field-finishedAt').element as HTMLInputElement).disabled).toBe(true);
      expect(wrapper.text()).toContain('calculated from the episodes');
    });

    it('saves a picked date when the dates are not derived from episodes', async () => {
      const patch = vi.fn().mockResolvedValue(season);
      const { wrapper } = await open(
        {
          getDetail: vi.fn().mockResolvedValue(season),
          seasonEpisodes: vi.fn().mockResolvedValue({ ...EMPTY_EPISODES, datesDerived: false }),
          patch,
        },
        '/seasons/30/edit',
        '/seasons/30',
      );
      expect((wrapper.find('#field-startedAt').element as HTMLInputElement).disabled).toBe(false);
      expect(wrapper.text()).not.toContain('calculated from the episodes');
      await pickDate(wrapper.get('#field-finishedAt'), '2026-01-12');
      await wrapper.get('form').trigger('submit');
      await flushPromises();
      expect(patch).toHaveBeenCalledWith('seasons', 30, { finishedAt: '2026-01-12' }, {});
    });
  });
});
