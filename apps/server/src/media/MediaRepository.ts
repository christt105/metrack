import type { MediaEntity } from './MediaEntity.js';

/** What the editing layer needs from a table repository, independent of the entity type. */
export interface MediaRepository {
  get(id: number): Promise<MediaEntity | undefined>;
  list(): Promise<MediaEntity[]>;
  create(input: Record<string, unknown>): Promise<MediaEntity>;
  update(id: number, patch: Record<string, unknown>): Promise<MediaEntity>;
  delete(id: number): Promise<boolean>;
  override(id: number, fields: Record<string, unknown>): Promise<MediaEntity>;
  clearOverride(id: number, field: string): Promise<MediaEntity>;
  overriddenFields(id: number): Promise<string[]>;
}
