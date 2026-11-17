import type { MediaStatus } from '@metrack/domain';
import type { FieldSchema } from './FieldSchema';
import { toDraft } from './formDraft';
import type { Draft } from './formDraft';

/** What the edit form holds next to the entity it started from. */
export interface FormState {
  schemas: FieldSchema[];
  entity: object;
  draft: Draft;
  status: MediaStatus;
  pendingReview: boolean;
  releases: readonly string[];
}

/** Counts the edits waiting to be saved. It never throws, so it works on half-typed input. */
export function countFormChanges(state: FormState): number {
  const record = state.entity as Record<string, unknown>;
  const original = toDraft(state.schemas, state.entity);
  let count = 0;
  for (const schema of state.schemas) {
    const next = state.draft[schema.key];
    if (next !== undefined && next !== original[schema.key]) count++;
  }
  if ('status' in record && state.status !== record.status) count++;
  if ('pendingReview' in record && state.pendingReview !== (record.pendingReview === true)) count++;
  return count + state.releases.length;
}
