import type { AlertKey } from '@metrack/domain';
import type { AlertSubject } from '../alerts/AlertSubject.js';
import type { FollowedTitle } from '../alerts/FollowedTitle.js';
import type { ReconciledSeason } from '../alerts/ReconciledSeason.js';
import type { ReleaseState } from '../alerts/ReleaseState.js';
import type { ReleaseStore } from '../alerts/ReleaseStore.js';
import type { SeriesRelease } from '../alerts/SeriesRelease.js';
import type { NewReleaseAlert } from '../storage/repositories/NewReleaseAlert.js';
import type { CloudClient } from './CloudClient.js';

/**
 * One user's release store over the `/api/connector` routes. The state is read once and kept until `invalidate`, so
 * a pass makes one read however many titles it looks at. An alert that was delivered but could not be recorded is
 * kept here, counts as sent, and is recorded again before the next read, so a cloud outage does not repeat it.
 */
export class CloudReleaseStore implements ReleaseStore {
  private cached: ReleaseState | undefined;
  private readonly unrecorded: NewReleaseAlert[] = [];

  constructor(
    private readonly cloud: CloudClient,
    private readonly userId: number,
  ) {}

  /** Drops the state read earlier, so the next read sees what changed in the cloud. */
  invalidate(): void {
    this.cached = undefined;
  }

  async topic(): Promise<string> {
    return (await this.state()).ntfyTopic;
  }

  async followedSeries(): Promise<FollowedTitle[]> {
    return (await this.state()).series;
  }

  async followedMovies(): Promise<FollowedTitle[]> {
    return (await this.state()).movies;
  }

  async reconcileSeasons(
    seriesId: number,
    release: SeriesRelease,
    today: string,
  ): Promise<ReconciledSeason[]> {
    return (await this.cloud.reconcileSeasons(this.userId, { seriesId, release, today })).seasons;
  }

  async sentAlerts(subjects: readonly AlertSubject[]): Promise<AlertKey[]> {
    const keys = [
      ...(await this.state()).alerts,
      ...this.unrecorded.map(({ subjectType, subjectId, kind }) => ({
        subjectType,
        subjectId,
        kind,
      })),
    ];
    return keys.filter((key) =>
      subjects.some((s) => s.subjectType === key.subjectType && s.subjectId === key.subjectId),
    );
  }

  async recordAlert(alert: NewReleaseAlert): Promise<void> {
    this.unrecorded.push(alert);
    await this.flush();
  }

  private async state(): Promise<ReleaseState> {
    if (this.cached) return this.cached;
    await this.flush().catch(() => undefined);
    this.cached = await this.cloud.releaseState(this.userId);
    return this.cached;
  }

  private async flush(): Promise<void> {
    if (this.unrecorded.length === 0) return;
    await this.cloud.recordAlerts(this.userId, { alerts: this.unrecorded });
    if (this.cached) {
      const keys = this.unrecorded.map(({ subjectType, subjectId, kind }) => ({
        subjectType,
        subjectId,
        kind,
      }));
      this.cached = { ...this.cached, alerts: [...this.cached.alerts, ...keys] };
    }
    this.unrecorded.length = 0;
  }
}
