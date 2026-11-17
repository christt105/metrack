import { describe, expect, it } from 'vitest';
import { pickSeasonsGroup, planSeasonRefresh } from '../src/index.js';
import type { ProviderSeason, Season } from '../src/index.js';

function season(overrides: Partial<Season>): Season {
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
    watchedCount: 0,
    cover: null,
    banner: null,
    slug: null,
    tags: [],
    status: 'planned',
    startedAt: null,
    finishedAt: null,
    rating: null,
    review: null,
    rewatches: [],
    pendingReview: false,
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderSeason>): ProviderSeason {
  return {
    number: 1,
    title: null,
    overview: null,
    firstAirDate: null,
    episodeCount: null,
    posterUrl: null,
    ...overrides,
  };
}

const frierenGroup: ProviderSeason[] = [
  provider({ number: 1, title: 'Season 1', firstAirDate: '2023-09-29', episodeCount: 28 }),
  provider({ number: 2, title: 'Season 2', firstAirDate: '2026-01-16', episodeCount: 10 }),
];

describe('planSeasonRefresh', () => {
  it('links a season by its stored provider number and fills what differs', () => {
    const plan = planSeasonRefresh(
      [season({ id: 7, number: 1, tmdbSeasonNumber: 1, title: 'Old', episodeCount: 12 })],
      [provider({ number: 1, title: 'New', overview: 'Text', episodeCount: 12 })],
    );
    expect(plan.updates).toEqual([
      { seasonId: 7, fields: { title: 'New', overview: 'Text' }, coverUrl: null },
    ]);
    expect(plan.unlinked).toEqual([]);
  });

  it('links unlinked seasons by the date of their first episode, not by number', () => {
    const plan = planSeasonRefresh(
      [season({ id: 5, number: 4, firstAirDate: '2026-01-16', episodeCount: 10 })],
      frierenGroup,
    );
    expect(plan.updates).toEqual([
      { seasonId: 5, fields: { tmdbSeasonNumber: 2, title: 'Season 2' }, coverUrl: null },
    ]);
  });

  it('links an undated season by number when the provider has it', () => {
    const plan = planSeasonRefresh([season({ id: 5, number: 2 })], frierenGroup);
    expect(plan.updates[0]?.fields).toMatchObject({ tmdbSeasonNumber: 2, episodeCount: 10 });
  });

  it('reports a season the provider does not know as unlinked', () => {
    const plan = planSeasonRefresh(
      [
        season({ id: 1, number: 1, tmdbSeasonNumber: 1 }),
        season({ id: 2, number: 2, firstAirDate: '2026-01-16' }),
      ],
      [provider({ number: 1, firstAirDate: '2023-09-29' })],
    );
    expect(plan.unlinked.map((s) => s.id)).toEqual([2]);
  });

  it('ignores stored links with relink and clears the ones that match nothing', () => {
    const plan = planSeasonRefresh(
      [
        season({ id: 1, number: 1, tmdbSeasonNumber: 1, firstAirDate: '2023-09-29' }),
        season({ id: 2, number: 2, tmdbSeasonNumber: 2, firstAirDate: '2030-01-01' }),
      ],
      frierenGroup,
      true,
    );
    expect(plan.updates.find((u) => u.seasonId === 2)?.fields).toEqual({ tmdbSeasonNumber: null });
    expect(plan.updates.find((u) => u.seasonId === 1)?.fields.title).toBe('Season 1');
    expect(plan.unlinked.map((s) => s.id)).toEqual([2]);
  });

  it('offers the poster only to seasons without a cover', () => {
    const posters = [provider({ number: 1, posterUrl: 'https://image.tmdb.org/p.jpg' })];
    const without = planSeasonRefresh([season({ id: 1, tmdbSeasonNumber: 1 })], posters);
    const withCover = planSeasonRefresh(
      [season({ id: 1, tmdbSeasonNumber: 1, cover: 'img:abc' })],
      posters,
    );
    expect(without.updates[0]?.coverUrl).toBe('https://image.tmdb.org/p.jpg');
    expect(withCover.updates).toEqual([]);
  });

  it('writes nothing when the season already matches', () => {
    const plan = planSeasonRefresh(
      [
        season({
          id: 1,
          tmdbSeasonNumber: 1,
          title: 'Season 1',
          firstAirDate: '2023-09-29',
          episodeCount: 28,
        }),
      ],
      frierenGroup,
    );
    expect(plan.updates).toEqual([]);
  });
});

describe('pickSeasonsGroup', () => {
  it('picks the only group with that season number', () => {
    expect(
      pickSeasonsGroup(
        [
          { id: 'a', seasonNumbers: [0, 1, 2] },
          { id: 'b', seasonNumbers: [1] },
        ],
        [2],
      ),
    ).toBe('a');
  });

  it('needs the group to have every number', () => {
    const candidates = [
      { id: 'a', seasonNumbers: [1, 2] },
      { id: 'b', seasonNumbers: [1, 2, 3] },
    ];
    expect(pickSeasonsGroup(candidates, [2])).toBeNull();
    expect(pickSeasonsGroup(candidates, [2, 3])).toBe('b');
  });

  it('picks nothing when none or several groups have it', () => {
    expect(pickSeasonsGroup([{ id: 'a', seasonNumbers: [1] }], [2])).toBeNull();
    expect(
      pickSeasonsGroup(
        [
          { id: 'a', seasonNumbers: [1, 2] },
          { id: 'b', seasonNumbers: [1, 2] },
        ],
        [2],
      ),
    ).toBeNull();
  });
});
