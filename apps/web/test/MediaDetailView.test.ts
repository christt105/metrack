import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MediaDetailView from '../src/views/MediaDetailView.vue';
import { mountWithApi } from './mountWithApi';

const movie = {
  id: 4,
  tmdbId: 10,
  title: 'Heat',
  genres: [],
  cast: [],
  follow: false,
  status: 'completed',
  rating: 5,
  review: null,
  rewatches: [],
  pendingReview: false,
  tags: [],
  cover: null,
  banner: null,
  editedFields: [],
  fetchedAt: null,
};

describe('MediaDetailView', () => {
  it('links to the edit route and holds no form', async () => {
    const { wrapper } = await mountWithApi(
      MediaDetailView,
      { getDetail: vi.fn().mockResolvedValue(movie) },
      { collection: 'movies', id: 4 },
    );
    await flushPromises();
    expect(wrapper.find('a[href="/movies/4/edit"]').exists()).toBe(true);
    expect(wrapper.find('form.entity-form').exists()).toBe(false);
    expect(wrapper.find('#edit').exists()).toBe(false);
  });
});
