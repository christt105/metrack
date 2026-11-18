import { existsSync, readFileSync } from 'node:fs';
import type { TmdbEpisodeMatch } from '../providers/tmdb/TmdbEpisodeMatch.js';
import { writeFileAtomic } from '../mirror/writeFileAtomic.js';

/** Days after which an episode TMDB did not know is asked about again. */
export const NEGATIVE_RETRY_DAYS = 7;

interface Entry {
  /** The TMDB episode id, or null when TMDB had no match. */
  tmdb: number | null;
  /** The TMDB series the episode belongs to; null when TMDB did not say. Absent in files written before it was kept. */
  show?: number | null;
  /** The day it was looked up, `YYYY-MM-DD`. */
  at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The TMDB episode id of each TheTVDB episode id, in a JSON file. The relation never changes, so a match is kept
 * for good; an episode TMDB did not know is asked about again after `NEGATIVE_RETRY_DAYS`. An unreadable file reads as empty.
 */
export class TvdbEpisodeIdCache {
  private readonly entries = new Map<number, Entry>();
  private dirty = false;

  constructor(private readonly path: string) {
    if (!existsSync(path)) return;
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Entry>;
      for (const [id, entry] of Object.entries(parsed)) {
        if (
          typeof entry.at === 'string' &&
          (entry.tmdb === null || typeof entry.tmdb === 'number')
        ) {
          const show =
            typeof entry.show === 'number' ? entry.show : entry.show === null ? null : undefined;
          this.entries.set(Number(id), {
            tmdb: entry.tmdb,
            at: entry.at,
            ...(show === undefined ? {} : { show }),
          });
        }
      }
    } catch {
      this.entries.clear();
    }
  }

  /**
   * The cached episode; null when TMDB is known not to have it (recently); undefined when it has to be asked,
   * which includes a match stored without its series.
   */
  lookup(tvdbId: number, today: string): TmdbEpisodeMatch | null | undefined {
    const entry = this.entries.get(tvdbId);
    if (!entry) return undefined;
    if (entry.tmdb !== null) {
      return entry.show === undefined ? undefined : { id: entry.tmdb, showId: entry.show };
    }
    const age = (Date.parse(today) - Date.parse(entry.at)) / DAY_MS;
    return age >= NEGATIVE_RETRY_DAYS ? undefined : null;
  }

  record(tvdbId: number, match: TmdbEpisodeMatch | null, today: string): void {
    this.entries.set(
      tvdbId,
      match === null
        ? { tmdb: null, at: today }
        : { tmdb: match.id, show: match.showId, at: today },
    );
    this.dirty = true;
  }

  /** Writes the file when something was recorded since the last time. */
  flush(): void {
    if (!this.dirty) return;
    writeFileAtomic(this.path, `${JSON.stringify(Object.fromEntries(this.entries))}\n`);
    this.dirty = false;
  }
}
