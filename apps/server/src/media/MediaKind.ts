import type { Collection, ImageKind, MediaSummary, MediaType } from '@metrack/domain';
import type { MediaEntity } from './MediaEntity.js';
import type { MediaRepository } from './MediaRepository.js';
import type { SummaryContext } from './SummaryContext.js';

/** Everything the generic editing and listing code needs to know about one entity collection. */
export interface MediaKind {
  collection: Collection;
  type: MediaType;
  repository: MediaRepository;
  /** Whether the entity carries status, dates, rating and rewatches. */
  trackable: boolean;
  /** Fields a manual edit protects from being overwritten by a metadata refresh. */
  metadataFields: readonly string[];
  imageKinds: readonly ImageKind[];
  /** Entity fields filled in when creating, so a create body only needs the required ones. */
  defaults(): Record<string, unknown>;
  /** Builds the list row from the entity and the preloaded series and seasons, without querying. */
  summarize(entity: MediaEntity, context: SummaryContext): MediaSummary;
  /** Rejects values that reference records that do not exist. Runs before an entity is created. */
  checkReferences?(values: Record<string, unknown>): Promise<void>;
  /** Extra properties the detail response carries on top of the entity. */
  extend?(entity: MediaEntity): Promise<Record<string, unknown>>;
}
