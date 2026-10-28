import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
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
  rating: 8,
  review: null,
  rewatches: [],
  note: null,
  slug: null,
  tags: [],
  cover: null,
  banner: null,
  editedFields: ['title'],
  fetchedAt: null,
} as unknown as AnyDetail;

describe('EntityForm', () => {
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
    const patch = vi.fn().mockResolvedValue({ ...movie, rating: 9 });
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('#field-rating').setValue('9');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).toHaveBeenCalledWith('movies', 4, { rating: 9 });
    expect(wrapper.emitted('saved')).toHaveLength(1);
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
    await wrapper.find('#field-rating').setValue('3');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain('Status change not allowed');
    expect((wrapper.find('#field-rating').element as HTMLInputElement).value).toBe('3');
  });

  it('flags an invalid rating without calling the API', async () => {
    const patch = vi.fn();
    const { wrapper } = await mountWithApi(
      EntityForm,
      { patch },
      { collection: 'movies', detail: movie },
    );
    await wrapper.find('#field-rating').setValue('12');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(patch).not.toHaveBeenCalled();
    expect(wrapper.find('.problem').exists()).toBe(true);
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
