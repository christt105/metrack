import type { SearchableType } from './SearchableType.js';

/**
 * A title a provider found. `externalId` is what `POST /api/titles` takes; `existingId` is the id of
 * the entity already holding it, or null when the title is not in the tracker yet.
 */
export interface SearchResult {
  type: SearchableType;
  provider: string;
  externalId: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  existingId: number | null;
}
