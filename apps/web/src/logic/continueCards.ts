import type { MediaSummary } from '@metrack/domain';
import { toCard, type LibraryCard } from './buildCards';

/**
 * The cards of the Continue shelf: in progress items, and for a series with several seasons each season being
 * watched or rewatched as its own card. A series whose watched seasons are not in `items` keeps its series card.
 */
export function continueCards(items: MediaSummary[], cards: LibraryCard[]): LibraryCard[] {
  const watchedSeasons = new Map<number, LibraryCard[]>();
  for (const item of items) {
    if (item.type !== 'season' || item.seriesId === null || !item.watching) continue;
    const list = watchedSeasons.get(item.seriesId) ?? [];
    list.push(toCard(item));
    watchedSeasons.set(item.seriesId, list);
  }
  return cards.flatMap((card) => {
    if (card.type === 'series' && card.watching && card.status === null) {
      return watchedSeasons.get(card.id) ?? [card];
    }
    return card.status === 'in_progress' || card.watching ? [card] : [];
  });
}
