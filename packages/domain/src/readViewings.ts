import { normalizeViewings } from './normalizeViewings.js';
import type { Viewing } from './Viewing.js';

/**
 * Reads viewings from stored or submitted data: a plain date string is a closed viewing without a start (the
 * old list of finish dates), an object carries `startedAt` and `finishedAt`. Anything else is skipped and the
 * result is normalized.
 */
export function readViewings(items: readonly unknown[]): Viewing[] {
  return normalizeViewings(
    items.flatMap((item): Viewing[] => {
      if (typeof item === 'string') return [{ startedAt: null, finishedAt: item }];
      if (typeof item === 'object' && item !== null) {
        const { startedAt, finishedAt } = item as Record<string, unknown>;
        return [
          {
            startedAt: typeof startedAt === 'string' ? startedAt : null,
            finishedAt: typeof finishedAt === 'string' ? finishedAt : null,
          },
        ];
      }
      return [];
    }),
  );
}
