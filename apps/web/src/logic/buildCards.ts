import type { MediaSummary } from '@metrack/domain';

export type CardTypeFilter = '' | 'movie' | 'series' | 'season' | 'videogame' | 'book';

/** One tile of the library. A series with a single season is one card carrying that season's tracking. */
export interface LibraryCard {
  key: string;
  type: MediaSummary['type'];
  id: number;
  title: string;
  subtitle: string | null;
  cover: string | null;
  status: MediaSummary['status'];
  rating: number | null;
  seasonCount: number | null;
}

function toCard(item: MediaSummary): LibraryCard {
  return {
    key: `${item.type}-${item.id}`,
    type: item.type,
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    cover: item.cover,
    status: item.status,
    rating: item.rating,
    seasonCount: item.seasonCount,
  };
}

function singleSeasonCard(item: MediaSummary): LibraryCard {
  return {
    ...toCard(item),
    key: `series-${item.seriesId}`,
    type: 'series',
    id: item.seriesId as number,
    title: item.seriesTitle ?? item.title,
    subtitle: null,
    seasonCount: 1,
  };
}

/**
 * Turns the combined list into library cards. Seasons of a multi-season series are hidden behind
 * their series, a single-season series becomes one card with its season's tracking, and the
 * `season` filter shows every season as its own card.
 */
export function buildCards(items: MediaSummary[], filter: CardTypeFilter): LibraryCard[] {
  if (filter === 'season') return items.filter((item) => item.type === 'season').map(toCard);

  const seasonCount = new Map<number, number>();
  for (const item of items) {
    if (item.type === 'series') seasonCount.set(item.id, item.seasonCount ?? 0);
  }
  const withSeasonRow = new Set(
    items
      .filter((item) => item.type === 'season' && item.seriesId !== null)
      .map((item) => item.seriesId),
  );
  const isSingle = (seriesId: number | null): boolean =>
    seriesId !== null && seasonCount.get(seriesId) === 1 && withSeasonRow.has(seriesId);

  const cards: LibraryCard[] = [];
  for (const item of items) {
    if (item.type === 'season') {
      if (isSingle(item.seriesId)) cards.push(singleSeasonCard(item));
      continue;
    }
    if (item.type === 'series' && isSingle(item.id)) continue;
    cards.push(toCard(item));
  }
  if (filter === '' || filter === 'series') {
    return cards.filter((card) => filter === '' || card.type === 'series');
  }
  return cards.filter((card) => card.type === filter);
}
