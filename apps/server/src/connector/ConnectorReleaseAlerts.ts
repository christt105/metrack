import { readClock } from '../alerts/readClock.js';
import { ReleaseWatcher } from '../alerts/ReleaseWatcher.js';
import type { ReleaseSource } from '../alerts/ReleaseSource.js';
import type { FetchFn } from '../http/FetchFn.js';
import type { Logger } from '../notify/Logger.js';
import type { CloudClient } from './CloudClient.js';
import { CloudReleaseStore } from './CloudReleaseStore.js';
import type { DailyMessageCounter } from './DailyMessageCounter.js';
import { ReleaseAlertNotifier } from './ReleaseAlertNotifier.js';
import type { ReleaseAlertsConfig } from './ReleaseAlertsConfig.js';

/** The time zone of every user's alerts. */
export const ALERTS_TIME_ZONE = 'Europe/Madrid';

/** How long the list of users and each user's state may go unread while no title is due. */
export const STATE_REFRESH_MS = 6 * 3_600_000;

interface UserEntry {
  store: CloudReleaseStore;
  watcher: ReleaseWatcher;
  readAt: number;
}

/**
 * Release alerts for every cloud user with an ntfy topic, checked from home. TMDB is asked from here; the cloud is
 * asked only for a user's state when one of their titles is due (and every `STATE_REFRESH_MS` to notice new
 * follows), so a tick with nothing due makes no cloud request. Nothing is checked before the configured local hour.
 */
export class ConnectorReleaseAlerts {
  private users: number[] | undefined;
  private usersReadAt = 0;
  private readonly entries = new Map<number, UserEntry>();

  constructor(
    private readonly cloud: CloudClient,
    private readonly source: ReleaseSource,
    private readonly config: ReleaseAlertsConfig,
    private readonly counter: DailyMessageCounter,
    private readonly logger: Logger,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async tick(): Promise<void> {
    const now = this.now();
    if (readClock(now, ALERTS_TIME_ZONE).hour < this.config.notifyFromHour) return;
    for (const userId of await this.alertUsers(now)) {
      try {
        await this.tickUser(userId, now);
      } catch (error) {
        this.logger.error(
          `release alerts failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async alertUsers(now: Date): Promise<number[]> {
    if (!this.users || now.getTime() - this.usersReadAt >= STATE_REFRESH_MS) {
      this.users = (await this.cloud.alertUsers()).map((user) => user.id);
      this.usersReadAt = now.getTime();
    }
    return this.users;
  }

  private async tickUser(userId: number, now: Date): Promise<void> {
    let entry = this.entries.get(userId);
    if (!entry) {
      entry = this.createEntry(userId, now);
      this.entries.set(userId, entry);
    }
    const stale = now.getTime() - entry.readAt >= STATE_REFRESH_MS;
    if (!stale && !entry.watcher.hasDue(now)) return;
    entry.store.invalidate();
    entry.readAt = now.getTime();
    await entry.watcher.tick();
  }

  private createEntry(userId: number, now: Date): UserEntry {
    const store = new CloudReleaseStore(this.cloud, userId);
    const watcher = new ReleaseWatcher({
      store,
      source: this.source,
      notifier: new ReleaseAlertNotifier(
        () => store.topic(),
        this.config.ntfyUrl,
        this.counter,
        this.logger,
        this.fetchFn,
      ),
      logger: this.logger,
      timeZone: ALERTS_TIME_ZONE,
      notifyFromHour: this.config.notifyFromHour,
      now: this.now,
    });
    return { store, watcher, readAt: now.getTime() - STATE_REFRESH_MS };
  }
}
