import type { MovieRelease } from '../../src/alerts/MovieRelease.js';
import type { ReleaseSource } from '../../src/alerts/ReleaseSource.js';
import type { SeriesRelease } from '../../src/alerts/SeriesRelease.js';

/** A release source that answers from tables the test edits. Unknown ids reject like a provider failure. */
export class FakeReleaseSource implements ReleaseSource {
  readonly seriesById = new Map<number, SeriesRelease>();
  readonly moviesById = new Map<number, MovieRelease>();
  calls: string[] = [];

  async series(tmdbId: number): Promise<SeriesRelease> {
    this.calls.push(`series:${tmdbId}`);
    const release = this.seriesById.get(tmdbId);
    if (!release) throw new Error(`no series ${tmdbId}`);
    return release;
  }

  async movie(tmdbId: number): Promise<MovieRelease> {
    this.calls.push(`movie:${tmdbId}`);
    const release = this.moviesById.get(tmdbId);
    if (!release) throw new Error(`no movie ${tmdbId}`);
    return release;
  }
}
