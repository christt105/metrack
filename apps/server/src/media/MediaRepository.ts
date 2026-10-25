import type { MediaEntity } from './MediaEntity.js';

/** What the editing layer needs from a table repository, independent of the entity type. */
export interface MediaRepository {
  get(id: number): MediaEntity | undefined;
  list(): MediaEntity[];
  create(input: Record<string, unknown>): MediaEntity;
  update(id: number, patch: Record<string, unknown>): MediaEntity;
  delete(id: number): boolean;
}
