import type { MediaType } from '@metrack/domain';

/** A note that could not be linked to an external id. */
export interface PlannedUnlinked {
  mediaType: MediaType;
  title: string;
  year: number | null;
  path: string;
}
