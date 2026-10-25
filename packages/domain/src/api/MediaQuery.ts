import type { MediaStatus } from '../MediaStatus.js';
import type { MediaType } from '../MediaType.js';
import type { MediaSortField } from './MediaSortField.js';

/**
 * Query string of `GET /api/media`. `q` matches titles ignoring case and accents. A series matches
 * `status` when any of its seasons has it. Missing values sort last in either direction.
 */
export interface MediaQuery {
  type?: MediaType;
  status?: MediaStatus;
  q?: string;
  sort?: MediaSortField;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
