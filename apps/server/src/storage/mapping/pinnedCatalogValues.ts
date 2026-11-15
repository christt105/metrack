import { hashContent } from '../../metadata/hashContent.js';

/**
 * The stored catalog values a patch would replace and an entry has not overridden yet: non-empty values that
 * differ from the patch, for fields the entry does not already override.
 */
export function pinnedCatalogValues(
  catalog: Record<string, unknown>,
  patch: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const pinned: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (field in overrides || !hasValue(catalog[field])) continue;
    if (hashContent(catalog[field]) !== hashContent(value)) pinned[field] = catalog[field];
  }
  return pinned;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !(Array.isArray(value) && value.length === 0);
}
