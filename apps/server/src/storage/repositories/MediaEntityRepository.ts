import type { EntityRepository } from './EntityRepository.js';
import type { UpdateOptions } from './UpdateOptions.js';

/**
 * A media type: a shared catalog row plus the signed-in user's personal entry. Every read sees only titles
 * the user has an entry for. `create` reuses the catalog row of a title someone else already added.
 * `update` writes catalog fields to the catalog unless they are overridden, and refuses to change them
 * when other users have the title too unless `allowSharedCatalog` says otherwise; `override` records hand edits, which win over the catalog for
 * this user only and survive refreshes. `delete` removes the user's entry, and the catalog row once
 * nobody has it.
 */
export interface MediaEntityRepository<T extends { id: number }> extends EntityRepository<T> {
  update(id: number, patch: Partial<Omit<T, 'id'>>, options?: UpdateOptions): Promise<T>;
  /** The user's entities among these ids, ordered by id; ids the user does not have are left out. */
  getMany(ids: readonly number[]): Promise<T[]>;
  override(id: number, fields: Partial<Omit<T, 'id'>>): Promise<T>;
  /** Drops a hand edit so the catalog value shows again. */
  clearOverride(id: number, field: string): Promise<T>;
  overriddenFields(id: number): Promise<string[]>;
  /** Writes provider data to the shared catalog row, whoever else has it. Entry fields are not allowed. */
  /**
   * Keeps the stored catalog values a patch is about to replace: for every entry of the row, in every user's
   * library, copies each non-empty value that differs from the patch into the entry's overrides unless the
   * entry already overrides the field. Returns the fields that were pinned for at least one entry.
   */
  pinCatalogValues(id: number, patch: Partial<Omit<T, 'id'>>): Promise<string[]>;
  updateCatalog(id: number, patch: Partial<Omit<T, 'id'>>): Promise<T>;
}
