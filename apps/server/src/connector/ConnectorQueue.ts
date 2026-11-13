import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { Scheduler } from '../publish/Scheduler.js';
import { ConnectorStateStore } from './ConnectorStateStore.js';
import type { ConnectorQueueOptions } from './ConnectorQueueOptions.js';
import { FailureAlert } from './FailureAlert.js';
import { retryDelay } from './retryDelay.js';

interface Entry {
  userId: number;
  dueAt: number;
  failures: number;
  scheduled: boolean;
  running: boolean;
  dirty: boolean;
  alert: FailureAlert;
}

/**
 * One pending sync per user. A webhook marks users dirty and the sync runs after the quiet time; changes that
 * arrive meanwhile are coalesced, and one that arrives during a sync triggers another afterwards. A failed sync
 * stays pending and is retried after 1, 5, 15 and then every 60 minutes, recomputing the plan each time, and a
 * run of failures is reported once through the notifier. Pending users are kept in the state file, so a restart
 * picks them up.
 */
export class ConnectorQueue {
  private readonly entries = new Map<number, Entry>();

  constructor(
    private readonly attempt: (userId: number) => Promise<string>,
    private readonly store: ConnectorStateStore,
    private readonly notifier: Notifier,
    private readonly logger: Logger,
    private readonly scheduler: Scheduler,
    private readonly options: ConnectorQueueOptions,
    private readonly now: () => number = Date.now,
  ) {}

  /** Schedules again every user the state file says was waiting. */
  restore(): void {
    for (const [id, saved] of Object.entries(this.store.read().pending)) {
      const entry = this.entry(Number(id));
      entry.failures = saved.failures;
      entry.dirty = true;
      this.wait(entry, Math.max(0, saved.dueAt - this.now()));
    }
  }

  markDirty(userId: number): void {
    const entry = this.entry(userId);
    entry.dirty = true;
    if (!entry.running && !entry.scheduled) this.wait(entry, this.options.debounceMs);
  }

  markAll(userIds: readonly number[]): void {
    for (const userId of userIds) this.markDirty(userId);
  }

  /** Consecutive failed attempts of the user so far. */
  failureCount(userId: number): number {
    return this.entries.get(userId)?.failures ?? 0;
  }

  private entry(userId: number): Entry {
    let entry = this.entries.get(userId);
    if (!entry) {
      entry = {
        userId,
        dueAt: 0,
        failures: 0,
        scheduled: false,
        running: false,
        dirty: false,
        alert: new FailureAlert(this.notifier, `sync of user ${userId}`),
      };
      this.entries.set(userId, entry);
    }
    return entry;
  }

  private wait(entry: Entry, delayMs: number): void {
    entry.scheduled = true;
    entry.dueAt = this.now() + delayMs;
    this.save();
    this.scheduler.schedule(() => {
      entry.scheduled = false;
      void this.run(entry);
    }, delayMs);
  }

  private async run(entry: Entry): Promise<void> {
    const { userId } = entry;
    entry.running = true;
    entry.dirty = false;
    try {
      const outcome = await this.attempt(userId);
      entry.failures = 0;
      this.logger.info(`Sync of user ${userId}: ${outcome}`);
      await entry.alert.recovered();
    } catch (error) {
      entry.failures += 1;
      entry.dirty = true;
      entry.running = false;
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync of user ${userId} failed (attempt ${entry.failures}): ${reason}`);
      await entry.alert.failed(entry.failures, reason);
      this.wait(entry, retryDelay(entry.failures));
      return;
    }
    entry.running = false;
    if (entry.dirty) this.wait(entry, this.options.debounceMs);
    else this.save();
  }

  private save(): void {
    const pending: Record<string, { dueAt: number; failures: number }> = {};
    for (const [id, entry] of this.entries) {
      if (entry.dirty || entry.scheduled || entry.running)
        pending[String(id)] = { dueAt: entry.dueAt, failures: entry.failures };
    }
    this.store.write({ ...this.store.read(), pending });
  }
}
