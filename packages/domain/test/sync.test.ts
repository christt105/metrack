import { describe, expect, it } from 'vitest';
import { planSync } from '../src/index.js';
import type {
  LibraryEpisode,
  LibraryMovie,
  LibrarySeason,
  LibrarySeries,
  Movie,
  PlayRecord,
  Season,
  Series,
  SyncState,
  Tracking,
} from '../src/index.js';

const TRACKING: Tracking = {
  status: 'planned',
  startedAt: null,
  finishedAt: null,
  rating: null,
  review: null,
  rewatches: [],
};
const ART = { cover: null, banner: null };

function movie(over: Partial<Movie>): Movie {
  return {
    id: 1,
    tmdbId: 10,
    jellyfinId: null,
    title: 'Movie',
    originalTitle: null,
    releaseDate: null,
    overview: null,
    genres: [],
    cast: [],
    director: null,
    follow: false,
    note: null,
    slug: null,
    tags: [],
    ...ART,
    ...TRACKING,
    ...over,
  };
}

function series(over: Partial<Series>): Series {
  return {
    id: 1,
    tmdbId: null,
    tvdbId: null,
    jellyfinId: null,
    title: 'Series',
    originalTitle: null,
    firstAirDate: null,
    overview: null,
    genres: [],
    cast: [],
    follow: false,
    note: null,
    slug: null,
    tags: [],
    review: null,
    ...ART,
    ...over,
  };
}

function season(over: Partial<Season>): Season {
  return {
    id: 1,
    seriesId: 1,
    number: 1,
    tmdbSeasonNumber: null,
    jellyfinId: null,
    title: null,
    overview: null,
    firstAirDate: null,
    episodeCount: null,
    slug: null,
    tags: [],
    ...ART,
    ...TRACKING,
    ...over,
  };
}

function episodes(prefix: string, count: number, firstDay: string): LibraryEpisode[] {
  const start = Date.parse(firstDay);
  return Array.from({ length: count }, (_, i) => ({
    jellyfinId: `${prefix}${i + 1}`,
    number: i + 1,
    airDate: new Date(start + i * 7 * 86_400_000).toISOString().slice(0, 10),
    runtimeSeconds: 1500,
    available: true,
  }));
}

function librarySeason(id: string, number: number, eps: LibraryEpisode[]): LibrarySeason {
  return { jellyfinId: id, number, title: null, episodes: eps };
}

function play(itemId: string, day: string, seconds = 1500): PlayRecord {
  return { itemId, playedAt: `${day}T20:00:00Z`, watchedSeconds: seconds };
}

const EMPTY: SyncState = { movies: [], series: [], seasons: [], overrides: [], unlinked: [] };
const BASE = { today: '2026-10-25', timeZone: 'Europe/Madrid' };

const libraryMovie: LibraryMovie = {
  jellyfinId: 'm1',
  title: 'Movie',
  year: 2020,
  tmdbId: 10,
  runtimeSeconds: 6000,
};

describe('movies', () => {
  const run = (state: SyncState, plays: PlayRecord[], movies = [libraryMovie]) =>
    planSync({ ...BASE, movies, series: [], plays, state });

  it('creates a completed movie with the day it was watched', () => {
    const plan = run(EMPTY, [play('m1', '2026-02-01', 6000)]);
    expect(plan.movies).toEqual([
      expect.objectContaining({
        action: 'create',
        movieId: null,
        finishedAt: '2026-02-01',
        rewatches: [],
        missingRating: true,
      }),
    ]);
  });

  it('ignores playback below 90% of the runtime', () => {
    expect(run(EMPTY, [play('m1', '2026-02-01', 5000)]).movies).toEqual([]);
  });

  it('counts below-threshold playback of a movie the server marks as played', () => {
    const played = { ...libraryMovie, played: true };
    const plan = run(
      EMPTY,
      [play('m1', '2026-02-01', 3000), play('m1', '2026-02-03', 5000)],
      [played],
    );
    expect(plan.movies).toEqual([
      expect.objectContaining({ action: 'create', finishedAt: '2026-02-03' }),
    ]);
  });

  it('still ignores played items that have no playback history', () => {
    expect(run(EMPTY, [], [{ ...libraryMovie, played: true }]).movies).toEqual([]);
  });

  it('sums sessions of the same day', () => {
    expect(
      run(EMPTY, [play('m1', '2026-02-01', 3000), play('m1', '2026-02-01', 3000)]).movies,
    ).toHaveLength(1);
  });

  it('uses the date in the configured time zone', () => {
    const late = { itemId: 'm1', playedAt: '2026-02-01T23:30:00Z', watchedSeconds: 6000 };
    expect(run(EMPTY, [late]).movies[0]?.finishedAt).toBe('2026-02-02');
  });

  it('completes an unfinished movie without touching rating or review', () => {
    const state = { ...EMPTY, movies: [movie({ status: 'planned', rating: 8, review: 'kept' })] };
    const [change] = run(state, [play('m1', '2026-02-01', 6000)]).movies;
    expect(change).toMatchObject({
      action: 'complete',
      movieId: 1,
      finishedAt: '2026-02-01',
      missingRating: false,
    });
    expect(change).not.toHaveProperty('rating');
    expect(change).not.toHaveProperty('review');
  });

  it('adds a rewatch only for viewings after the recorded date', () => {
    const state = {
      ...EMPTY,
      movies: [movie({ status: 'completed', finishedAt: '2026-02-01', startedAt: '2026-02-01' })],
    };
    expect(run(state, [play('m1', '2026-02-01', 6000)]).movies).toEqual([]);
    const plan = run(state, [play('m1', '2026-02-01', 6000), play('m1', '2026-05-10', 6000)]);
    expect(plan.movies[0]).toMatchObject({ action: 'rewatch', rewatches: ['2026-05-10'] });
    const done = {
      ...EMPTY,
      movies: [movie({ status: 'completed', finishedAt: '2026-02-01', rewatches: ['2026-05-10'] })],
    };
    expect(run(done, [play('m1', '2026-05-10', 6000)]).movies).toEqual([]);
  });

  it('treats a viewing past midnight as the recorded one', () => {
    const state = { ...EMPTY, movies: [movie({ status: 'completed', finishedAt: '2026-02-01' })] };
    expect(run(state, [play('m1', '2026-02-02', 6000)]).movies).toEqual([]);
    expect(run(state, [play('m1', '2026-02-03', 6000)]).movies).toHaveLength(1);
  });

  it('leaves dropped movies alone and warns', () => {
    const state = { ...EMPTY, movies: [movie({ status: 'dropped' })] };
    const plan = run(state, [play('m1', '2026-02-01', 6000)]);
    expect(plan.movies).toEqual([]);
    expect(plan.warnings[0]?.code).toBe('dropped_with_plays');
  });

  it('sends watched movies without ids to the unlinked inbox once', () => {
    const noId = { ...libraryMovie, tmdbId: null };
    const plan = run(EMPTY, [play('m1', '2026-02-01', 6000)], [noId]);
    expect(plan.unlinked).toEqual([
      expect.objectContaining({ mediaType: 'movie', jellyfinId: 'm1', plays: 1 }),
    ]);
    const known: SyncState = {
      ...EMPTY,
      unlinked: [
        {
          id: 1,
          mediaType: 'movie',
          title: 'Movie',
          year: null,
          source: 'jellyfin',
          sourceRef: 'm1',
          createdAt: 'x',
        },
      ],
    };
    expect(run(known, [play('m1', '2026-02-01', 6000)], [noId]).unlinked).toEqual([]);
  });

  it('counts playback of unknown items', () => {
    const plan = run(EMPTY, [
      { ...play('zzz', '2026-02-01'), title: 'Gone' },
      { ...play('yyy', '2026-02-02'), title: 'Gone' },
    ]);
    expect(plan.ignoredPlays).toBe(2);
    expect(plan.unmatchedTitles).toEqual([{ title: 'Gone', plays: 2 }]);
  });
});

describe('Lupin: season 3 in TMDB is season 4 in Jellyfin', () => {
  const eps = episodes('l', 3, '2026-10-23').map((e) => ({ ...e, airDate: '2026-10-23' }));
  const lupin: LibrarySeries = {
    jellyfinId: 's-lupin',
    title: 'Lupin',
    year: 2021,
    tmdbId: 96677,
    tvdbId: 375921,
    seasons: [librarySeason('sn4', 4, eps)],
  };
  const stored: SyncState = {
    ...EMPTY,
    series: [series({ id: 7, tmdbId: 96677, tvdbId: 375921, title: 'Lupin' })],
    seasons: [
      season({
        id: 70,
        seriesId: 7,
        number: 1,
        firstAirDate: '2021-01-08',
        status: 'completed',
        finishedAt: '2022-07-28',
      }),
      season({
        id: 71,
        seriesId: 7,
        number: 2,
        firstAirDate: '2023-10-05',
        status: 'completed',
        finishedAt: '2023-10-14',
      }),
      season({
        id: 72,
        seriesId: 7,
        number: 3,
        tmdbSeasonNumber: 3,
        firstAirDate: '2026-10-23',
        episodeCount: 8,
      }),
    ],
  };
  const run = (plays: PlayRecord[], state = stored) =>
    planSync({ ...BASE, movies: [], series: [lupin], plays, state });

  it('pairs by first episode date, renumbers to 4 and keeps the TMDB number', () => {
    const plan = run([play('l1', '2026-10-24')]);
    const [change] = plan.series;
    expect(change?.seriesId).toBe(7);
    expect(change?.seasons).toEqual([
      expect.objectContaining({
        seasonId: 72,
        matchedBy: 'air_date',
        number: 4,
        tmdbSeasonNumber: 3,
        jellyfinSeasonId: 'sn4',
        status: 'in_progress',
        startedAt: '2026-10-24',
        finishedAt: null,
        episodeCount: 3,
        watchedEpisodes: 1,
      }),
    ]);
  });

  it('completes the season on the day its last episode was first watched', () => {
    const plan = run([
      play('l1', '2026-10-24'),
      play('l2', '2026-10-24'),
      play('l3', '2026-10-25'),
      play('l1', '2026-10-26'),
    ]);
    expect(plan.series[0]?.seasons[0]).toMatchObject({
      status: 'completed',
      startedAt: '2026-10-24',
      finishedAt: '2026-10-25',
      missingRating: true,
    });
  });

  it('remembers the stored number as the TMDB number when it was not recorded', () => {
    const unnumbered: SyncState = {
      ...stored,
      seasons: stored.seasons.map((s) => (s.id === 72 ? { ...s, tmdbSeasonNumber: null } : s)),
    };
    expect(run([play('l1', '2026-10-24')], unnumbered).series[0]?.seasons[0]).toMatchObject({
      number: 4,
      tmdbSeasonNumber: 3,
    });
  });

  it('does not touch seasons 1 and 2 of the vault', () => {
    const plan = run([play('l1', '2026-10-24')]);
    expect(plan.series[0]?.seasons.map((s) => s.seasonId)).toEqual([72]);
  });

  it('honours a season override that points at the Jellyfin season', () => {
    const noDates: SyncState = {
      ...stored,
      seasons: stored.seasons.map((s) => (s.id === 72 ? { ...s, firstAirDate: null } : s)),
      overrides: [
        { seriesId: 7, tmdbSeasonNumber: 3, number: 4, title: null, jellyfinSeasonId: 'sn4' },
      ],
    };
    expect(run([play('l1', '2026-10-24')], noDates).series[0]?.seasons[0]).toMatchObject({
      seasonId: 72,
      matchedBy: 'override',
      number: 4,
    });
  });

  it('is idempotent once the plan has been applied', () => {
    const applied: SyncState = {
      ...stored,
      series: stored.series.map((s) => ({ ...s, jellyfinId: 's-lupin' })),
      seasons: stored.seasons.map((s) =>
        s.id === 72
          ? {
              ...s,
              number: 4,
              jellyfinId: 'sn4',
              episodeCount: 3,
              status: 'in_progress' as const,
              startedAt: '2026-10-24',
            }
          : s,
      ),
    };
    expect(run([play('l1', '2026-10-24')], applied).series).toEqual([]);
  });

  it('refuses to renumber onto a number already in use', () => {
    const clash: SyncState = {
      ...stored,
      seasons: [
        ...stored.seasons,
        season({ id: 73, seriesId: 7, number: 4, firstAirDate: '2027-01-01' }),
      ],
    };
    const plan = run([play('l1', '2026-10-24')], clash);
    expect(plan.warnings[0]?.code).toBe('season_number_conflict');
    expect(plan.series.flatMap((s) => s.seasons)).toEqual([]);
  });
});

describe('Dan Da Dan: one TMDB season of 24 episodes, two in Jellyfin', () => {
  const first = episodes('d', 12, '2024-10-04');
  const second = episodes('e', 12, '2025-07-04');
  const dandadan: LibrarySeries = {
    jellyfinId: 's-ddd',
    title: 'Dan Da Dan',
    year: 2024,
    tmdbId: 240411,
    tvdbId: 427460,
    seasons: [librarySeason('d-s1', 1, first), librarySeason('d-s2', 2, second)],
  };
  const stored: SyncState = {
    ...EMPTY,
    series: [series({ id: 3, tmdbId: 240411, title: 'Dan Da Dan' })],
    seasons: [
      season({
        id: 30,
        seriesId: 3,
        number: 1,
        tmdbSeasonNumber: 1,
        firstAirDate: '2024-10-04',
        episodeCount: 24,
      }),
    ],
  };
  const allPlays = [...first, ...second].map((e, i) =>
    play(e.jellyfinId, i < 12 ? '2025-01-10' : '2025-08-20'),
  );
  const run = (plays: PlayRecord[]) =>
    planSync({ ...BASE, movies: [], series: [dandadan], plays, state: stored });

  it('completes season 1 at 12 episodes and creates season 2 from the library', () => {
    const [change] = run(allPlays).series;
    const [s1, s2] = change?.seasons ?? [];
    expect(s1).toMatchObject({
      seasonId: 30,
      matchedBy: 'air_date',
      number: 1,
      status: 'completed',
      episodeCount: 12,
      finishedAt: '2025-01-10',
    });
    expect(s2).toMatchObject({
      seasonId: null,
      matchedBy: 'new',
      number: 2,
      status: 'completed',
      startedAt: '2025-08-20',
      finishedAt: '2025-08-20',
    });
    expect(run(allPlays).warnings.map((w) => w.code)).toContain('episode_count_mismatch');
  });

  it('keeps a half-watched second season in progress', () => {
    const plays = [...first.map((e) => play(e.jellyfinId, '2025-01-10')), play('e1', '2025-08-01')];
    const [change] = run(plays).series;
    expect(change?.seasons[1]).toMatchObject({
      status: 'in_progress',
      watchedEpisodes: 1,
      finishedAt: null,
    });
  });

  it('does not complete a season that still has episodes to air', () => {
    const airing = {
      ...dandadan,
      seasons: [librarySeason('d-s1', 1, episodes('d', 12, '2026-10-01'))],
    };
    const plays = airing.seasons[0]!.episodes.slice(0, 4).map((e) =>
      play(e.jellyfinId, '2026-10-20'),
    );
    const plan = planSync({ ...BASE, movies: [], series: [airing], plays, state: EMPTY });
    expect(plan.series[0]?.seasons[0]?.status).toBe('in_progress');
  });

  it('creates a series that is not stored, with ids from the library', () => {
    const plan = planSync({
      ...BASE,
      movies: [],
      series: [dandadan],
      plays: [play('d1', '2025-01-10')],
      state: EMPTY,
    });
    expect(plan.series[0]).toMatchObject({ seriesId: null, tmdbId: 240411, tvdbId: 427460 });
    expect(plan.series[0]?.seasons[0]).toMatchObject({
      seasonId: null,
      matchedBy: 'new',
      status: 'in_progress',
    });
  });

  it('sends a watched series without ids to the unlinked inbox', () => {
    const noIds = { ...dandadan, tmdbId: null, tvdbId: null };
    const plan = planSync({
      ...BASE,
      movies: [],
      series: [noIds],
      plays: [play('d1', '2025-01-10')],
      state: EMPTY,
    });
    expect(plan.series).toEqual([]);
    expect(plan.unlinked).toEqual([expect.objectContaining({ mediaType: 'series', plays: 1 })]);
  });

  it('keeps completed seasons untouched', () => {
    const done: SyncState = {
      ...stored,
      seasons: [
        season({
          id: 30,
          seriesId: 3,
          number: 1,
          firstAirDate: '2024-10-04',
          episodeCount: 12,
          jellyfinId: 'd-s1',
          status: 'completed',
          startedAt: '2024-11-01',
          finishedAt: '2024-12-01',
          rating: 9,
        }),
      ],
    };
    const plan = planSync({
      ...BASE,
      movies: [],
      series: [dandadan],
      plays: first.map((e) => play(e.jellyfinId, '2025-01-10')),
      state: done,
    });
    expect(plan.series.flatMap((s) => s.seasons)).toEqual([]);
  });
});
