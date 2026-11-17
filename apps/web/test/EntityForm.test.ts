import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../src/api/ApiClient';
import { ApiRequestError } from '../src/api/ApiRequestError';
import { Session } from '../src/auth/Session';
import { sessionKey } from '../src/auth/sessionKey';
import type { AnyDetail } from '../src/api/AnyDetail';
import EntityForm from '../src/components/EntityForm.vue';
import { mountWithApi } from './mountWithApi';

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

afterEach(() => vi.unstubAllGlobals());

describe('EntityForm', () => {
  it('asks the owner before changing a field other users hold, then saves it for everyone', async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    const patch = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError('shared', 409, 'catalog_shared'))
      .mockResolvedValueOnce({ ...movie, tmdbId: 11 });
    const session = new Session({} as ApiClient);
    session.signedIn({ id: 1, name: 'O', email: null, role: 'owner' });
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: movie },
      { [sessionKey as symbol]: session },
    );
    await wrapper.find('#field-tmdbId').setValue('11');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('every user who has this series'));
    expect(patch).toHaveBeenLastCalledWith('movies', 4, { tmdbId: 11 }, { forAll: true });
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('offers only valid status transitions', async () => {
    const { wrapper } = await mountWithApi(EntityForm, {}, { collection: 'movies', detail: movie });
    const options = wrapper.findAll('#field-status option').map((o) => o.attributes('value'));
    expect(options).toEqual(['in_progress', 'completed']);
  });

  it('marks hand-edited fields and releases them through the API', async () => {
    const unmarkEdited = vi.fn().mockResolvedValue(undefined);
    const { wrapper } = await mountWithApi(
      EntityForm,
      { unmarkEdited },
      { collection: 'movies', detail: movie },
    );
    expect(wrapper.findAll('.edited')).toHaveLength(1);
    await wrapper.find('.field .below button').trigger('click');
    expect(unmarkEdited).toHaveBeenCalledWith('movies', 4, 'title');
    expect(wrapper.emitted('changed')).toHaveLength(1);
  });

  it('sends only the changed fields', async () => {
    const patch = vi.fn().mockResolvedValue({ ...movie, rating: 7 });
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('#field-rating [data-rating="7"]').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { rating: 7 }, {});
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('confirms a pending viewing together with the edits', async () => {
    const pending = { ...movie, pendingReview: true } as AnyDetail;
    const patch = vi.fn().mockResolvedValue({ ...movie, rating: 7 });
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: pending },
    );
    expect(wrapper.find('.pending-notice').exists()).toBe(true);
    await wrapper.find('#field-rating [data-rating="7"]').trigger('click');
    await wrapper.find('.actions button[type="button"]').trigger('click');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { rating: 7, pendingReview: false }, {});
  });

  it('keeps a pending viewing pending on a plain save', async () => {
    const pending = { ...movie, pendingReview: true } as AnyDetail;
    const patch = vi.fn().mockResolvedValue(pending);
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: pending },
    );
    await wrapper.find('#field-rating [data-rating="7"]').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { rating: 7 }, {});
  });

  it('offers no confirmation for a confirmed viewing', async () => {
    const { wrapper } = await mountWithApi(EntityForm, {}, { collection: 'movies', detail: movie });
    expect(wrapper.find('.pending-notice').exists()).toBe(false);
    expect(wrapper.find('.actions button[type="button"]').exists()).toBe(false);
  });

  it('shows the API error and keeps the draft', async () => {
    const error = Object.assign(new Error('Status change not allowed'), {
      status: 409,
      code: 'invalid_transition',
    });
    const patch = vi.fn().mockRejectedValue(error);
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('#field-rating [data-rating="3"]').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('Status change not allowed');
    expect(wrapper.find('#field-rating [data-rating="3"]').attributes('aria-checked')).toBe('true');
  });

  it('clears the rating with the no rating option', async () => {
    const patch = vi.fn().mockResolvedValue({ ...movie, rating: null });
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('#field-rating [data-rating="none"]').trigger('click');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { rating: null }, {});
  });

  it('leaves out the fields the quick actions own', async () => {
    const { wrapper } = await mountWithApi(
      EntityForm,
      {},
      { collection: 'movies', detail: movie, omit: ['status', 'rating', 'review'] },
    );
    expect(wrapper.find('#field-status').exists()).toBe(false);
    expect(wrapper.find('#field-rating').exists()).toBe(false);
    expect(wrapper.find('#field-review').exists()).toBe(false);
    expect(wrapper.find('#field-startedAt').exists()).toBe(true);
  });

  it('links a note that Obsidian or a browser can open', async () => {
    const note = 'obsidian://open?vault=Atlas&file=Heat';
    const { wrapper } = await mountWithApi(
      EntityForm,
      {},
      { collection: 'movies', detail: { ...movie, note } as AnyDetail },
    );
    expect(wrapper.find('a.open-link').attributes('href')).toBe(note);
    await wrapper.find('#field-note').setValue('javascript:alert(1)');
    expect(wrapper.find('a.open-link').exists()).toBe(false);
  });
});
