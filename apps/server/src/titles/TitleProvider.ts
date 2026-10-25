import type { EntityRef, SearchableType, SearchResult } from '@metrack/domain';

/** A source of titles that can be searched and turned into tracker entities. */
export interface TitleProvider {
  readonly type: SearchableType;
  readonly provider: string;
  search(query: string, year: number | null): Promise<SearchResult[]>;
  /** Creates the entity (with its seasons for series) and fills its metadata. */
  add(externalId: string): Promise<EntityRef>;
}
