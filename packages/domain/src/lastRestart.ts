import type { AbandonedPass } from './AbandonedPass.js';

/** The day the current pass of a season began after being started over, or null when it was never started over. */
export function lastRestart(abandoned: readonly AbandonedPass[]): string | null {
  return abandoned.reduce<string | null>(
    (latest, pass) => (latest === null || pass.restartedOn > latest ? pass.restartedOn : latest),
    null,
  );
}
