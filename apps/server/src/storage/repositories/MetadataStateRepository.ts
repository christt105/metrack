import type { MediaType } from '@metrack/domain';
import type { MetadataState } from '../../metadata/MetadataState.js';

/** The cache bookkeeping of each entity: when it was fetched, the hash of what came back, and hand-edited fields. */
export interface MetadataStateRepository {
  get(type: MediaType, id: number): Promise<MetadataState>;
  /** Records a refresh. Pass `metadataHash` only when the content changed. */
  markFetched(type: MediaType, id: number, fetchedAt: string, metadataHash?: string): Promise<void>;
  /** Protects a field from being overwritten by provider data. */
  markEdited(type: MediaType, id: number, field: string): Promise<void>;
  unmarkEdited(type: MediaType, id: number, field: string): Promise<void>;
}
