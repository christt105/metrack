import type { LibraryCard } from './buildCards';

/** The cards of the Continue shelf: in progress, or a series with a season being watched or rewatched. */
export function continueCards(cards: LibraryCard[]): LibraryCard[] {
  return cards.filter((card) => card.status === 'in_progress' || card.watching);
}
