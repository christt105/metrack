import type { MediaType } from '@metrack/domain';
import type { MetadataState } from '../../metadata/MetadataState.js';

/** The cache bookkeeping of each catalog row (when it was fetched and the hash of what came back) plus its hand-edited fields. */
export interface MetadataStateRepository {
  get(type: MediaType, id: number): Promise<MetadataState>;
  /** Records a refresh. Pass `metadataHash` only when the content changed. */
  markFetched(type: MediaType, id: number, fetchedAt: string, metadataHash?: string): Promise<void>;
}
