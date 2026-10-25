import type { EntityRef } from './EntityRef.js';
import type { RefreshResult } from './RefreshResult.js';

/** The entity created from an unlinked title and what the metadata refresh did, when one is available. */
export interface ResolveUnlinkedResponse extends EntityRef {
  refresh: RefreshResult | null;
}
