import type { AlertKey } from '@metrack/domain';
import type { NewReleaseAlert } from '../storage/repositories/NewReleaseAlert.js';
import type { AlertSubject } from './AlertSubject.js';
import type { FollowedTitle } from './FollowedTitle.js';
import type { ReconciledSeason } from './ReconciledSeason.js';
import type { SeriesRelease } from './SeriesRelease.js';

/**
 * Where the release watcher keeps what it reads and writes, for one user: at home the repositories, in the
 * connector calls to the cloud. Every method may reject, which the watcher treats like any failed check.
 */
export interface ReleaseStore {
  followedSeries(): Promise<FollowedTitle[]>;
  followedMovies(): Promise<FollowedTitle[]>;
  /** Links the seasons the source announces to the series' seasons and creates the new ones. */
  reconcileSeasons(
    seriesId: number,
    release: SeriesRelease,
    today: string,
  ): Promise<ReconciledSeason[]>;
  /** The keys already recorded for these subjects. */
  sentAlerts(subjects: readonly AlertSubject[]): Promise<AlertKey[]>;
  /** Records an alert that was delivered. Recording the same key twice is harmless. */
  recordAlert(alert: NewReleaseAlert): Promise<void>;
}
