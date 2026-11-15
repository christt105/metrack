export const TMDB = 'https://api.themoviedb.org/3';
export const FRIEREN_ID = 209867;
export const FRIEREN_SEASONS_GROUP = '679231eba8ce3489ceb57efc';
export const FRIEREN_COURS_GROUP = '64f988c1ffc9de00c4a24917';
export const DANDADAN_ID = 240411;
export const DANDADAN_SEASONS_GROUP = '6867281200716e516c5e35b0';

interface GroupEpisode {
  season_number: number;
  episode_number: number;
  air_date: string;
  order: number;
}

function episodes(season: number, from: number, to: number, airDate: string): GroupEpisode[] {
  return Array.from({ length: to - from + 1 }, (_, index) => ({
    season_number: season,
    episode_number: from + index,
    air_date: index === 0 ? airDate : '2099-01-01',
    order: index,
  }));
}

/** Frieren's "Seasons" group: order 1 is 1x01 to 1x28, order 2 is 1x29 to 1x38, order 0 holds specials. */
export function frierenSeasonsGroup(): object {
  return {
    id: FRIEREN_SEASONS_GROUP,
    name: 'Seasons',
    type: 6,
    episode_count: 64,
    group_count: 3,
    groups: [
      { id: 'g1', name: 'Season 1', order: 1, episodes: episodes(1, 1, 28, '2023-09-29') },
      { id: 'g0', name: 'Specials', order: 0, episodes: episodes(0, 1, 2, '2023-10-11') },
      { id: 'g2', name: 'Season 2', order: 2, episodes: episodes(1, 29, 38, '2026-01-16') },
    ],
  };
}

export function frierenGroups(): object {
  return {
    id: FRIEREN_ID,
    results: [
      { id: 'abs', name: 'Absolute Order', type: 2, episode_count: 63, group_count: 3 },
      {
        id: FRIEREN_SEASONS_GROUP,
        name: 'Seasons',
        type: 6,
        episode_count: 64,
        group_count: 3,
      },
      { id: FRIEREN_COURS_GROUP, name: 'Cours', type: 7, episode_count: 38, group_count: 3 },
    ],
  };
}

/** Frieren as TMDB lists it: one regular season of 38 episodes. */
export function frierenDetails(extra: object = {}): object {
  return {
    id: FRIEREN_ID,
    name: 'Frieren: Beyond Journey’s End',
    number_of_seasons: 1,
    seasons: [
      { season_number: 0, name: 'Specials', episode_count: 2, air_date: '2023-10-11' },
      {
        season_number: 1,
        name: 'Season 1',
        overview: 'The whole run.',
        episode_count: 38,
        air_date: '2023-09-29',
        poster_path: null,
      },
    ],
    ...extra,
  };
}

export function danDaDanDetails(): object {
  return {
    id: DANDADAN_ID,
    name: 'DAN DA DAN',
    number_of_seasons: 1,
    seasons: [{ season_number: 1, name: 'Season 1', episode_count: 24, air_date: '2024-10-04' }],
  };
}

export function danDaDanGroups(): object {
  return {
    id: DANDADAN_ID,
    results: [
      { id: 'italian', name: 'Italian Sort', type: 4, episode_count: 24, group_count: 2 },
      {
        id: DANDADAN_SEASONS_GROUP,
        name: 'Seasons',
        type: 6,
        episode_count: 24,
        group_count: 2,
      },
      { id: 'arc', name: 'Arc', type: 7, episode_count: 0, group_count: 0 },
    ],
  };
}

export function danDaDanSeasonsGroup(): object {
  return {
    id: DANDADAN_SEASONS_GROUP,
    name: 'Seasons',
    type: 6,
    groups: [
      { id: 'd1', name: 'Season 1', order: 1, episodes: episodes(1, 1, 12, '2024-10-04') },
      { id: 'd2', name: 'Season 2', order: 2, episodes: episodes(1, 13, 24, '2025-07-03') },
    ],
  };
}
