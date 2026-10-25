import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@metrack/domain';
import { buildCards } from '../src/logic/buildCards';

function summary(
  partial: Partial<MediaSummary> & Pick<MediaSummary, 'type' | 'id' | 'title'>,
): MediaSummary {
  return {
    subtitle: null,
    releaseDate: null,
    cover: null,
    status: null,
    rating: null,
    startedAt: null,
    finishedAt: null,
    seriesId: null,
    seriesTitle: null,
    seasonCount: null,
    ...partial,
  };
}

const items: MediaSummary[] = [
  summary({ type: 'movie', id: 1, title: 'Heat', status: 'completed', rating: 9 }),
  summary({ type: 'series', id: 2, title: 'Dan Da Dan', seasonCount: 1 }),
  summary({
    type: 'season',
    id: 20,
    title: 'Season 1',
    seriesId: 2,
    seriesTitle: 'Dan Da Dan',
    status: 'in_progress',
    rating: 8,
  }),
  summary({ type: 'series', id: 3, title: 'Frieren', seasonCount: 2 }),
  summary({
    type: 'season',
    id: 30,
    title: 'Season 1',
    seriesId: 3,
    seriesTitle: 'Frieren',
    status: 'completed',
  }),
  summary({
    type: 'season',
    id: 31,
    title: 'Season 2',
    seriesId: 3,
    seriesTitle: 'Frieren',
    status: 'planned',
  }),
];

describe('buildCards', () => {
  it('shows a single-season series as one card with the season tracking', () => {
    const cards = buildCards(items, '');
    const card = cards.find((c) => c.title === 'Dan Da Dan');
    expect(card).toMatchObject({
      type: 'series',
      id: 2,
      status: 'in_progress',
      rating: 8,
      seasonCount: 1,
    });
    expect(cards.filter((c) => c.title === 'Dan Da Dan')).toHaveLength(1);
  });

  it('hides the seasons of a multi-season series behind the series', () => {
    const cards = buildCards(items, '');
    expect(cards.map((c) => c.key)).toEqual(['movie-1', 'series-2', 'series-3']);
  });

  it('lists every season on its own for the season filter', () => {
    expect(buildCards(items, 'season').map((c) => c.id)).toEqual([20, 30, 31]);
  });

  it('keeps only series cards for the series filter', () => {
    expect(buildCards(items, 'series').map((c) => c.key)).toEqual(['series-2', 'series-3']);
  });

  it('keeps a single-season series visible when its season row is missing', () => {
    const lone = items.filter((item) => item.id !== 20);
    expect(buildCards(lone, '').map((c) => c.key)).toContain('series-2');
  });

  it('filters by a plain type', () => {
    expect(buildCards(items, 'movie').map((c) => c.id)).toEqual([1]);
  });
});
