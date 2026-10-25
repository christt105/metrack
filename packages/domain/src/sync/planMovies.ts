import type { Movie } from '../Movie.js';
import type { LibraryMovie } from './LibraryMovie.js';
import type { MovieChange } from './MovieChange.js';
import type { SyncState } from './SyncState.js';
import type { SyncWarning } from './SyncWarning.js';
import type { UnlinkedChange } from './UnlinkedChange.js';

export interface MoviePlan {
  changes: MovieChange[];
  unlinked: UnlinkedChange[];
  warnings: SyncWarning[];
}

/** The day after `day`: a viewing that runs past midnight is the same viewing the vault dated by its start. */
function nextDay(day: string): string {
  return new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10);
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

/**
 * Turns the viewing days of each movie into changes. A movie without a finish date completes on its first
 * viewing; viewings after the recorded finish date become rewatches. Notes and reviews are never touched.
 */
export function planMovies(
  library: readonly LibraryMovie[],
  watchDays: ReadonlyMap<string, string[]>,
  playCount: ReadonlyMap<string, number>,
  state: SyncState,
): MoviePlan {
  const plan: MoviePlan = { changes: [], unlinked: [], warnings: [] };
  for (const movie of library) {
    const days = watchDays.get(movie.jellyfinId);
    const first = days?.[0];
    if (!days || first === undefined) continue;
    const existing: Movie | undefined =
      state.movies.find((m) => m.jellyfinId === movie.jellyfinId) ??
      (movie.tmdbId === null ? undefined : state.movies.find((m) => m.tmdbId === movie.tmdbId));
    const tmdbId = movie.tmdbId ?? existing?.tmdbId ?? null;
    if (tmdbId === null) {
      const known = state.unlinked.some(
        (u) => u.source === 'jellyfin' && u.sourceRef === movie.jellyfinId,
      );
      if (!known) {
        plan.unlinked.push({
          mediaType: 'movie',
          jellyfinId: movie.jellyfinId,
          title: movie.title,
          year: movie.year,
          plays: playCount.get(movie.jellyfinId) ?? 0,
        });
      }
      continue;
    }
    const base = {
      movieId: existing?.id ?? null,
      jellyfinId: movie.jellyfinId,
      tmdbId,
      title: existing?.title ?? movie.title,
      year: movie.year,
    };
    if (!existing) {
      plan.changes.push({
        ...base,
        action: 'create',
        startedAt: first,
        finishedAt: first,
        rewatches: days.slice(1),
        missingRating: true,
      });
      continue;
    }
    if (existing.status === 'dropped') {
      plan.warnings.push({
        code: 'dropped_with_plays',
        title: existing.title,
        message: 'Marked as dropped but has completed viewings; left unchanged.',
      });
      continue;
    }
    if (existing.status !== 'completed' || existing.finishedAt === null) {
      plan.changes.push({
        ...base,
        action: 'complete',
        startedAt: existing.startedAt ?? first,
        finishedAt: first,
        rewatches: union(existing.rewatches, days.slice(1)),
        missingRating: existing.rating === null,
      });
      continue;
    }
    const finishedAt = existing.finishedAt;
    const sameViewing = nextDay(finishedAt);
    const later = days.filter((day) => day > sameViewing);
    const rewatches = union(existing.rewatches, later);
    if (!sameList(rewatches, existing.rewatches)) {
      plan.changes.push({
        ...base,
        action: 'rewatch',
        startedAt: existing.startedAt,
        finishedAt,
        rewatches,
        missingRating: existing.rating === null,
      });
    }
  }
  return plan;
}
