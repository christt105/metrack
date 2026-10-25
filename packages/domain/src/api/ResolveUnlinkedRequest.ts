import type { ExternalIds } from './ExternalIds.js';

/** Body of `POST /api/unlinked/{id}/resolve`. At least one id valid for the title's type is required. */
export interface ResolveUnlinkedRequest {
  ids: ExternalIds;
}
