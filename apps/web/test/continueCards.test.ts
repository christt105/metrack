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
        status,
      }),
    ),
  ];
}

describe('continueCards', () => {
  const items = [
    ...threeSeasons(1, 'Season two airing', ['completed', 'in_progress', 'planned'], true),
    ...threeSeasons(2, 'Open rewatch', ['completed', 'completed', 'completed'], true),
    ...threeSeasons(3, 'All done', ['completed', 'completed', 'completed'], false),
    summary({ type: 'movie', id: 4, title: 'Heat', status: 'in_progress' }),
  ];

  it('lists multi-season series being watched or rewatched with the series card', () => {
    const shelf = continueCards(buildCards(items, ''));
    expect(shelf.map((card) => [card.type, card.title]).sort()).toEqual([
      ['movie', 'Heat'],
      ['series', 'Open rewatch'],
      ['series', 'Season two airing'],
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
