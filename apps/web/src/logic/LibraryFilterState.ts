import type { MediaSortField, MediaStatus } from '@metrack/domain';
import type { CardTypeFilter } from './buildCards';

/** What the library filter bar edits. Empty strings mean "any". */
export interface LibraryFilterState {
  q: string;
  type: CardTypeFilter;
  status: MediaStatus | '';
  sort: MediaSortField;
  order: 'asc' | 'desc';
}
