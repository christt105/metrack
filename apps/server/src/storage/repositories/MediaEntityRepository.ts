import type { EntityRepository } from './EntityRepository.js';

/**
 * A media type: a shared catalog row plus the signed-in user's personal entry. Every read sees only titles
 * the user has an entry for. `create` reuses the catalog row of a title someone else already added.
 * `update` writes catalog fields to the catalog unless they are overridden, and refuses to change them
 * when other users have the title too; `override` records hand edits, which win over the catalog for
 * this user only and survive refreshes. `delete` removes the user's entry, and the catalog row once
 * nobody has it.
 */
export interface MediaEntityRepository<T extends { id: number }> extends EntityRepository<T> {
  /** The user's entities among these ids, ordered by id; ids the user does not have are left out. */
  getMany(ids: readonly number[]): Promise<T[]>;
  override(id: number, fields: Partial<Omit<T, 'id'>>): Promise<T>;
  /** Drops a hand edit so the catalog value shows again. */
  clearOverride(id: number, field: string): Promise<T>;
  overriddenFields(id: number): Promise<string[]>;
  /** Writes provider data to the shared catalog row, whoever else has it. Entry fields are not allowed. */
  updateCatalog(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T>;
}
