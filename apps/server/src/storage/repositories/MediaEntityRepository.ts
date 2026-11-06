import type { EntityRepository } from './EntityRepository.js';

/**
 * A media type: a shared catalog row plus the personal entry. `update` writes catalog fields to the catalog
 * unless they are overridden; `override` records hand edits, which win over the catalog and survive refreshes.
 */
export interface MediaEntityRepository<T extends { id: number }> extends EntityRepository<T> {
  override(id: number, fields: Partial<Omit<T, 'id'>>): Promise<T>;
  /** Drops a hand edit so the catalog value shows again. */
  clearOverride(id: number, field: string): Promise<T>;
  overriddenFields(id: number): Promise<string[]>;
}
