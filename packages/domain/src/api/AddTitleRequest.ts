import type { SearchableType } from './SearchableType.js';

/** Body of `POST /api/titles`. */
export interface AddTitleRequest {
  type: SearchableType;
  externalId: string;
}
