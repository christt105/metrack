import {
  checkIntervalMinutes,
  planReleaseAlerts,
  type AlertCandidate,
  type AlertKey,
  type AlertSubjectType,
} from '@metrack/domain';
import { readClock } from './readClock.js';
import { reconcileSeasons } from './reconcileSeasons.js';
import { releaseAlertText } from './releaseAlertText.js';
import type { ReleaseWatcherDeps } from './ReleaseWatcherDeps.js';
import type { WatchSummary } from './WatchSummary.js';

const MINUTE_MS = 60_000;
const RETRY_MINUTES = 30;

interface Subject {
  candidate: AlertCandidate;
  title: string;
}

/**
 * Looks at every followed series and movie when it is due, creates the seasons a source announces and
 * sends each alert once. How often a title is looked at depends on how close its release is, so a
 * premiere is noticed within minutes instead of a day later. Due times are kept in memory: after a
 * restart every followed title is checked once, which is harmless because alerts are recorded in the database.
 * An alert is recorded only after the notifier delivered it; one that could not be delivered stays
 * pending and the title is checked again like after any other failure.
 */
export class ReleaseWatcher {
  private readonly nextCheck = new Map<string, number>();

  constructor(private readonly deps: ReleaseWatcherDeps) {}

  /** Checks the titles that are due. */
  async tick(): Promise<WatchSummary> {
    const summary: WatchSummary = { checked: 0, seasonsCreated: 0, alertsSent: 0, failures: 0 };
    const now = this.now();
    const local = readClock(now, this.deps.timeZone);
    if (local.hour < this.deps.notifyFromHour) return summary;

    for (const series of this.deps.series.listFollowed()) {
      if (series.tmdbId === null) continue;
      await this.check(`series:${series.id}`, now, summary, async () => {
        const release = await this.deps.source.series(series.tmdbId as number);
        const reconciled = reconcileSeasons(series.id, release, local.date, this.deps);
        summary.seasonsCreated += reconciled.filter((r) => r.created).length;
        const subjects = reconciled.map<Subject>((r) => ({
          title: `${series.title}, season ${r.season.number}`,
          candidate: {
            subjectType: 'season',
            subjectId: r.season.id,
            releaseDate: r.airDate,
            flatrateEs: release.flatrateEs,
          },
        }));
        await this.dispatch(subjects, release.posterUrl, local.date, now, summary);
        return subjects;
      });
    }
    for (const movie of this.deps.movies.listFollowed()) {
      if (movie.tmdbId === null) continue;
      await this.check(`movie:${movie.id}`, now, summary, async () => {
        const release = await this.deps.source.movie(movie.tmdbId as number);
        const subjects: Subject[] = [
          {
            title: movie.title,
            candidate: {
              subjectType: 'movie',
              subjectId: movie.id,
              releaseDate: release.releaseDate,
              flatrateEs: release.flatrateEs,
            },
          },
        ];
        await this.dispatch(subjects, release.posterUrl, local.date, now, summary);
        return subjects;
      });
    }
    return summary;
  }

  private async check(
    key: string,
    now: Date,
    summary: WatchSummary,
    run: () => Promise<Subject[]>,
  ): Promise<void> {
    if ((this.nextCheck.get(key) ?? 0) > now.getTime()) return;
    summary.checked += 1;
    try {
      const subjects = await run();
      const today = readClock(now, this.deps.timeZone).date;
      const minutes = Math.min(
        ...subjects.map((s) =>
          checkIntervalMinutes(s.candidate.subjectType, s.candidate.releaseDate, today),
        ),
        checkIntervalMinutes('season', null, today),
      );
      this.nextCheck.set(key, now.getTime() + minutes * MINUTE_MS);
    } catch (error) {
      summary.failures += 1;
      this.nextCheck.set(key, now.getTime() + RETRY_MINUTES * MINUTE_MS);
      this.deps.logger.error(
        `release check failed for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async dispatch(
    subjects: readonly Subject[],
    posterUrl: string | null,
    today: string,
    now: Date,
    summary: WatchSummary,
  ): Promise<void> {
    const sent = subjects.flatMap((s) =>
      this.deps.alerts.keysFor(s.candidate.subjectType, s.candidate.subjectId),
    );
    const due = planReleaseAlerts(
      subjects.map((s) => s.candidate),
      sent,
      today,
    );
    let undelivered = 0;
    for (const key of due) {
      const subject = subjects.find((s) => sameSubject(s.candidate, key));
      if (!subject) continue;
      const message = releaseAlertText(key.kind, subject.candidate.releaseDate ?? today);
      const delivered = await this.deps.notifier.notify(subject.title, message, {
        priority: 'default',
        tags: [key.kind === 'available_es' ? 'tv' : 'calendar'],
        ...(posterUrl === null ? {} : { imageUrl: posterUrl }),
      });
      if (!delivered) {
        undelivered += 1;
        continue;
      }
      this.deps.alerts.record({
        ...key,
        title: subject.title,
        message,
        sentAt: now.toISOString(),
      });
      summary.alertsSent += 1;
    }
    if (undelivered > 0) {
      throw new Error(`${undelivered} alert(s) could not be delivered`);
    }
  }

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }
}

function sameSubject(
  candidate: { subjectType: AlertSubjectType; subjectId: number },
  key: AlertKey,
): boolean {
  return candidate.subjectType === key.subjectType && candidate.subjectId === key.subjectId;
}
