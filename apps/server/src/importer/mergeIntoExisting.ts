const OVERWRITE = new Set(['status', 'finishedAt', 'rating', 'review', 'rewatches']);

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

/**
 * The fields of `incoming` that should change `existing`. Tracking fields always follow the
 * note, so clearing a rating in the vault clears it here. Every other field is only filled in
 * or changed, never emptied, so data fetched or edited since the last import survives.
 */
export function mergeIntoExisting<T extends object>(existing: T, incoming: Partial<T>): Partial<T> {
  const patch: Record<string, unknown> = {};
  const current = existing as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    if (isEmpty(value) && !OVERWRITE.has(key)) continue;
    if (JSON.stringify(value) !== JSON.stringify(current[key])) patch[key] = value;
  }
  return patch as Partial<T>;
}
