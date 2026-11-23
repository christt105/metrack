import type { AbandonedPass } from './AbandonedPass.js';

/** Reads abandoned passes from stored or submitted data, skipping anything without a `restartedOn`, oldest restart first. */
export function readAbandoned(items: readonly unknown[]): AbandonedPass[] {
  return items
    .flatMap((item): AbandonedPass[] => {
      if (typeof item !== 'object' || item === null) return [];
      const { startedAt, finishedAt, restartedOn } = item as Record<string, unknown>;
      if (typeof restartedOn !== 'string') return [];
      return [
        {
          startedAt: typeof startedAt === 'string' ? startedAt : null,
          finishedAt: typeof finishedAt === 'string' ? finishedAt : null,
          restartedOn,
        },
      ];
    })
    .sort((a, b) => a.restartedOn.localeCompare(b.restartedOn));
}
