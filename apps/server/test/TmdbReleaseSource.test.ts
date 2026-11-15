import { describe, expect, it } from 'vitest';
import { TmdbClient } from '../src/providers/tmdb/TmdbClient.js';
import { TmdbReleaseSource } from '../src/providers/tmdb/TmdbReleaseSource.js';
import { pathFetch } from './support/pathFetch.js';

const BASE = 'https://api.themoviedb.org/3';

function sourceFor(routes: Record<string, object>) {
  const net = pathFetch(routes);
  const source = new TmdbReleaseSource(
    new TmdbClient(net.fetch, { apiKey: 'key', language: 'es-ES' }),
  );
  return { source, net };
}

describe('TmdbReleaseSource', () => {
  it('maps a series with its seasons, next episode and flatrate providers in Spain', async () => {
    const { source, net } = sourceFor({
      [`${BASE}/tv/10`]: {
        poster_path: '/p.jpg',
        number_of_seasons: 3,
        seasons: [
          { season_number: 0, name: 'Specials', air_date: null, episode_count: 1 },
          { season_number: 3, name: '', overview: '', air_date: '2026-10-23', episode_count: 8 },
        ],
        next_episode_to_air: { season_number: 3, episode_number: 1, air_date: '2026-10-23' },
        'watch/providers': {
          results: { ES: { flatrate: [{ provider_name: 'Netflix' }] }, US: {} },
        },
      },
    });
    expect(await source.series(10)).toEqual({
      posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg',
      numberOfSeasons: 3,
      seasons: [
        { number: 0, name: 'Specials', overview: null, airDate: null, episodeCount: 1 },
        { number: 3, name: null, overview: null, airDate: '2026-10-23', episodeCount: 8 },
      ],
      nextEpisode: { seasonNumber: 3, episodeNumber: 1, airDate: '2026-10-23' },
      flatrateEs: true,
    });
    const url = new URL(net.calls[0] ?? '');
    expect(url.searchParams.get('append_to_response')).toBe('watch/providers');
  });

  it('ignores buy and rent providers and other regions', async () => {
    const { source } = sourceFor({
      [`${BASE}/tv/10`]: {
        'watch/providers': {
          results: {
            ES: { buy: [{ provider_name: 'Apple TV' }], rent: [{ provider_name: 'Apple TV' }] },
            US: { flatrate: [{ provider_name: 'Netflix' }] },
          },
        },
      },
    });
    const release = await source.series(10);
    expect(release.flatrateEs).toBe(false);
    expect(release.nextEpisode).toBeNull();
    expect(release.seasons).toEqual([]);
  });

  it('takes the earliest Spanish theatrical date for a movie, else the worldwide date', async () => {
    const { source } = sourceFor({
      [`${BASE}/movie/1`]: {
        release_date: '2026-09-01',
        release_dates: {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [{ type: 3, release_date: '2026-09-01T00:00:00.000Z' }],
            },
            {
              iso_3166_1: 'ES',
              release_dates: [
                { type: 4, release_date: '2026-10-01T00:00:00.000Z' },
                { type: 3, release_date: '2026-10-23T00:00:00.000Z' },
                { type: 2, release_date: '2026-10-20T00:00:00.000Z' },
              ],
            },
          ],
        },
      },
      [`${BASE}/movie/2`]: { release_date: '2026-11-05', poster_path: null },
      [`${BASE}/movie/3`]: {},
    });
    expect((await source.movie(1)).releaseDate).toBe('2026-10-20');
    expect(await source.movie(2)).toEqual({
      posterUrl: null,
      releaseDate: '2026-11-05',
      flatrateEs: false,
    });
    expect((await source.movie(3)).releaseDate).toBeNull();
  });

  it('rejects when TMDB fails', async () => {
    const { source } = sourceFor({});
    await expect(source.series(1)).rejects.toThrow('404');
  });

  describe('with an episode group', () => {
    const group = {
      id: 'g',
      name: 'Seasons',
      type: 6,
      groups: [
        {
          id: 'a',
          name: 'Season 1',
          order: 1,
          episodes: [1, 2].map((n) => episode(1, n, '2023-09-29')),
        },
        { id: 'b', name: 'Specials', order: 0, episodes: [episode(0, 1, '2023-10-11')] },
        {
          id: 'c',
          name: 'Season 2',
          order: 2,
          episodes: [episode(1, 3, '2026-01-16'), episode(1, 4, '2026-01-23')],
        },
      ],
    };

    function episode(season: number, number: number, airDate: string) {
      return { season_number: season, episode_number: number, air_date: airDate, order: 0 };
    }

    function frieren(next: object | null) {
      return {
        [`${BASE}/tv/10`]: {
          poster_path: '/p.jpg',
          number_of_seasons: 1,
          seasons: [
            { season_number: 1, name: 'Season 1', air_date: '2023-09-29', episode_count: 4 },
          ],
          next_episode_to_air: next,
        },
        [`${BASE}/tv/episode_group/g`]: group,
      };
    }

    it('lists the seasons of the group and numbers the next episode inside it', async () => {
      const { source } = sourceFor(
        frieren({ season_number: 1, episode_number: 4, air_date: '2026-01-23' }),
      );
      const release = await source.series(10, 'g');
      expect(release.numberOfSeasons).toBe(2);
      expect(release.seasons).toEqual([
        { number: 1, name: null, overview: null, airDate: '2023-09-29', episodeCount: 2 },
        { number: 2, name: null, overview: null, airDate: '2026-01-16', episodeCount: 2 },
      ]);
      expect(release.nextEpisode).toEqual({
        seasonNumber: 2,
        episodeNumber: 2,
        airDate: '2026-01-23',
      });
    });

    it('counts an episode the group does not hold as a new season after the last one', async () => {
      const { source } = sourceFor(
        frieren({ season_number: 1, episode_number: 5, air_date: '2026-04-10' }),
      );
      const release = await source.series(10, 'g');
      expect(release.numberOfSeasons).toBe(3);
      expect(release.seasons.at(-1)).toEqual({
        number: 3,
        name: null,
        overview: null,
        airDate: '2026-04-10',
        episodeCount: null,
      });
      expect(release.nextEpisode).toEqual({
        seasonNumber: 3,
        episodeNumber: 1,
        airDate: '2026-04-10',
      });
    });

    it('has no next episode when TMDB announces none', async () => {
      const { source } = sourceFor(frieren(null));
      expect((await source.series(10, 'g')).nextEpisode).toBeNull();
    });
  });
});
