import type { AlertKey } from '@metrack/domain';
import type { NewReleaseAlert } from '../storage/repositories/NewReleaseAlert.js';
import type { AlertSubject } from './AlertSubject.js';
import type { FollowedTitle } from './FollowedTitle.js';
import type { HomeReleaseStoreDeps } from './HomeReleaseStoreDeps.js';
import type { ReconciledSeason } from './ReconciledSeason.js';
import { reconcileSeasons } from './reconcileSeasons.js';
import type { ReleaseStore } from './ReleaseStore.js';
import type { SeriesRelease } from './SeriesRelease.js';

/** The release store over the repositories of whoever the surrounding scope is bound to. */
export class HomeReleaseStore implements ReleaseStore {
  constructor(private readonly deps: HomeReleaseStoreDeps) {}

  followedSeries(): Promise<FollowedTitle[]> {
    return this.deps.series.listFollowed();
  }

  followedMovies(): Promise<FollowedTitle[]> {
    return this.deps.movies.listFollowed();
  }

  reconcileSeasons(
    seriesId: number,
    release: SeriesRelease,
    today: string,
  ): Promise<ReconciledSeason[]> {
    return reconcileSeasons(seriesId, release, today, this.deps);
  }

  async sentAlerts(subjects: readonly AlertSubject[]): Promise<AlertKey[]> {
    const keys: AlertKey[] = [];
    for (const s of subjects) {
      keys.push(...(await this.deps.alerts.keysFor(s.subjectType, s.subjectId)));
    }
    return keys;
  }

  async recordAlert(alert: NewReleaseAlert): Promise<void> {
    await this.deps.alerts.record(alert);
  }
}
