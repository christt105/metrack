import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@metrack/domain';
import { buildCards } from '../src/logic/buildCards';
import { continueCards } from '../src/logic/continueCards';

function summary(
  partial: Partial<MediaSummary> & Pick<MediaSummary, 'type' | 'id' | 'title'>,
): MediaSummary {
  return {
    subtitle: null,
    releaseDate: null,
    cover: null,
    banner: null,
    status: null,
    rating: null,
    startedAt: null,
    finishedAt: null,
    seriesId: null,
    seriesTitle: null,
    seasonCount: null,
    pendingReview: false,
    watching: false,
    allAchievements: false,
    ...partial,
  };
}

function threeSeasons(
  id: number,
  title: string,
  statuses: MediaSummary['status'][],
  watching: boolean,
  watchingSeasons: number[] = [],
): MediaSummary[] {
  return [
    summary({ type: 'series', id, title, seasonCount: 3, watching }),
    ...statuses.map((status, index) =>
      summary({
        type: 'season',
        id: id * 10 + index,
        title: `Season ${index + 1}`,
        seriesId: id,
        seriesTitle: title,
        subtitle: title,
        status,
        watching: watchingSeasons.includes(index),
      }),
    ),
  ];
}

describe('continueCards', () => {
  const items = [
    ...threeSeasons(1, 'Season two airing', ['completed', 'in_progress', 'planned'], true, [1]),
    ...threeSeasons(2, 'Open rewatch', ['completed', 'completed', 'completed'], true, [0]),
    ...threeSeasons(3, 'All done', ['completed', 'completed', 'completed'], false),
    summary({ type: 'movie', id: 4, title: 'Heat', status: 'in_progress' }),
  ];

  it('lists each season being watched or rewatched as its own card', () => {
    const shelf = continueCards(items, buildCards(items, ''));
    expect(shelf.map((card) => [card.type, card.id, card.title, card.subtitle]).sort()).toEqual([
      ['movie', 4, 'Heat', null],
      ['season', 11, 'Season 2', 'Season two airing'],
      ['season', 20, 'Season 1', 'Open rewatch'],
    ]);
  });

  it('shows season 3 in progress with seasons 1 and 2 completed', () => {
    const lupin = threeSeasons(5, 'Lupin', ['completed', 'completed', 'in_progress'], true, [2]);
    const shelf = continueCards(lupin, buildCards(lupin, ''));
    expect(shelf).toHaveLength(1);
    expect(shelf[0]).toMatchObject({ type: 'season', id: 52, status: 'in_progress' });
  });

  it('keeps the series card when none of its watched seasons is listed', () => {
    const series = [
      summary({ type: 'series', id: 6, title: 'Cut', seasonCount: 3, watching: true }),
    ];
    const shelf = continueCards(series, buildCards(series, ''));
    expect(shelf.map((card) => [card.type, card.title])).toEqual([['series', 'Cut']]);
  });

  it('keeps a single-season series as one series card', () => {
    const single = [
      summary({ type: 'series', id: 7, title: 'Monster', seasonCount: 1, watching: true }),
      summary({
        type: 'season',
        id: 70,
        title: 'Season 1',
        seriesId: 7,
        seriesTitle: 'Monster',
        status: 'in_progress',
        watching: true,
      }),
    ];
    const shelf = continueCards(single, buildCards(single, ''));
    expect(shelf.map((card) => [card.type, card.id, card.title])).toEqual([
      ['series', 7, 'Monster'],
    ]);
  });

  it('does not change the cards or their statuses', () => {
    const cards = buildCards(items, '');
    expect(cards.filter((card) => card.type === 'series').every((c) => c.status === null)).toBe(
      true,
    );
    expect(cards).toHaveLength(4);
  });
});
