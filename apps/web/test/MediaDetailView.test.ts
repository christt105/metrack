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

  it('opens the metadata source in a new tab when the movie has a provider id', async () => {
    const linked = await mountDetail('movies', movie);
    await flushPromises();
    const link = linked.wrapper.get('a.source-link');
    expect(link.text()).toBe('View on TMDB');
    expect(link.attributes()).toMatchObject({
      href: 'https://www.themoviedb.org/movie/10',
      target: '_blank',
      rel: 'noopener noreferrer',
    });

    const unlinked = await mountDetail('movies', { ...movie, tmdbId: null });
    await flushPromises();
    expect(unlinked.wrapper.find('a.source-link').exists()).toBe(false);
  });

  const series = {
    ...movie,
    id: 7,
    tmdbId: 20,
    title: 'Dark',
    seasons: [{ id: 70, number: 1, tmdbSeasonNumber: 1, status: 'planned', rating: null }],
  };
  it('waits for the current detail before showing a source link after navigation', async () => {
    let resolve!: (value: typeof series) => void;
    const next = new Promise<typeof series>((done) => {
      resolve = done;
    });
    const getDetail = vi.fn().mockResolvedValueOnce(movie).mockReturnValueOnce(next);
    const { wrapper } = await mountDetail('movies', movie, { getDetail });
    await flushPromises();
    expect(wrapper.get('a.source-link').attributes('href')).toBe(
      'https://www.themoviedb.org/movie/10',
    );

    await wrapper.setProps({ collection: 'series', id: series.id });
    expect(wrapper.find('a.source-link').exists()).toBe(false);

    resolve(series);
    await flushPromises();
    expect(wrapper.get('a.source-link').attributes('href')).toBe(
      'https://www.themoviedb.org/tv/20',
    );
  });

  const season = { ...movie, id: 70, seriesId: 7, number: 1, title: null };
  const groups = (wrapper: { findAll: (s: string) => { text: () => string }[] }) =>
    wrapper.findAll('.manage h3').map((h) => h.text());

  async function mountDetail(collection: string, detail: object, extra: object = {}) {
    return mountWithApi(
      MediaDetailView,
      { getDetail: vi.fn().mockResolvedValue(detail), ...extra },
      { collection, id: (detail as { id: number }).id },
    );
  }

  it('lists the manage groups of a movie in order', async () => {
    const { wrapper } = await mountDetail('movies', movie);
    await flushPromises();
    expect(wrapper.find('details.advanced').exists()).toBe(false);
    expect(groups(wrapper)).toEqual(['Rewatches', 'Images', 'Metadata', 'Danger zone']);
  });

  it('lists the manage groups of a series in order', async () => {
    const { wrapper } = await mountDetail('series', series);
    await flushPromises();
    expect(groups(wrapper)).toEqual(['Images', 'Season order', 'Metadata', 'Danger zone']);
  });

  it('offers to skip the filler only on animated series', async () => {
    const plain = await mountDetail('series', series);
    await flushPromises();
    expect(plain.wrapper.find('[data-test="filler-open"]').exists()).toBe(false);
    const anime = await mountDetail('series', { ...series, genres: ['Drama', 'Animación'] });
    await flushPromises();
    expect(anime.wrapper.find('[data-test="filler-open"]').exists()).toBe(true);
    const film = await mountDetail('movies', { ...movie, genres: ['Animation'] });
    await flushPromises();
    expect(film.wrapper.find('[data-test="filler-open"]').exists()).toBe(false);
  });

  it('lists the manage groups of a season, a game and a book', async () => {
    const seasonView = await mountDetail('seasons', season);
    await flushPromises();
    expect(groups(seasonView.wrapper)).toEqual(['Images', 'Danger zone']);
    const game = await mountDetail('games', { ...movie, id: 8 });
    await flushPromises();
    expect(groups(game.wrapper)).toEqual(['Playthroughs', 'Images', 'Danger zone']);
    const book = await mountDetail('books', { ...movie, id: 9 });
    await flushPromises();
    expect(groups(book.wrapper)).toEqual(['Readings', 'Images', 'Danger zone']);
  });

  it('offers no way to add a season by hand', async () => {
    const { wrapper } = await mountDetail('series', series);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Add season');
  });

  it('needs two steps to delete and redirects to the library', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const { wrapper, router } = await mountDetail('movies', movie, { remove });
    await flushPromises();
    const zone = () => wrapper.find('.danger-zone');
    await zone().find('button.danger').trigger('click');
    expect(remove).not.toHaveBeenCalled();
    expect(zone().text()).toContain('permanently deletes the entry');
    const buttons = zone().findAll('button');
    await buttons[1]?.trigger('click');
    expect(zone().text()).not.toContain('permanently deletes');
    expect(remove).not.toHaveBeenCalled();
    await zone().find('button.danger').trigger('click');
    await zone().find('button.danger').trigger('click');
    await flushPromises();
    expect(remove).toHaveBeenCalledWith('movies', 4);
    expect(router.currentRoute.value.fullPath).toBe('/');
  });

  it('sends a deleted season back to its series', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const { wrapper, router } = await mountDetail('seasons', season, { remove });
    await flushPromises();
    await wrapper.find('.danger-zone button.danger').trigger('click');
    await wrapper.find('.danger-zone button.danger').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/series/7');
  });

  describe('unmatched episodes', () => {
    const lost = [
      { code: 'episode_unmatched', season: 1, number: 2, name: 'Pilot' },
      { code: 'episode_unmatched', season: 2, number: 1, name: null },
    ];

    it('warns on the series page about every season', async () => {
      const { wrapper } = await mountDetail('series', { ...series, unmatched: lost });
      await flushPromises();
      const banner = wrapper.find('.unmatched');
      expect(banner.text()).toContain('2 watched episodes could not be recorded');
      expect(banner.findAll('a').map((a) => a.attributes('href'))).toEqual([
        'https://www.themoviedb.org/tv/20/season/1',
        'https://www.themoviedb.org/tv/20',
      ]);
    });

    it('warns on the season page only about its own season', async () => {
      const getDetail = vi
        .fn()
        .mockImplementation(async (collection: string) =>
          collection === 'series' ? series : season,
        );
      const seasonEpisodes = vi.fn().mockResolvedValue({
        seasonId: 70,
        source: 'tmdb',
        fetchedAt: null,
        complete: true,
        datesDerived: false,
        episodeCount: 0,
        watchedCount: 0,
        skippedCount: 0,
        wantsRewatch: false,
        episodes: [],
        unmatched: lost,
      });
      const { wrapper } = await mountDetail('seasons', season, { getDetail, seasonEpisodes });
      await flushPromises();
      const banner = wrapper.find('.unmatched');
      expect(banner.text()).toContain('1 watched episode could not be recorded');
      expect(banner.find('a').attributes('href')).toBe('https://www.themoviedb.org/tv/20/season/1');
    });
  });
});
