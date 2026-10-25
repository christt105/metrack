import { planSync, type SyncPlan } from '@metrack/domain';
import type { LibrarySource } from './LibrarySource.js';
import type { PlaybackSource } from './PlaybackSource.js';
import type { SyncApplier } from './SyncApplier.js';
import type { SyncApplyResult } from './SyncApplyResult.js';
import type { SyncTargets } from './SyncTargets.js';
import { loadSyncState } from './loadSyncState.js';

export interface SyncServiceOptions {
  timeZone: string;
  now?: () => Date;
}

/** Compares Jellyfin playback with the stored tracking. `report` never writes; `apply` always recomputes the plan first. */
export class SyncService {
  private readonly now: () => Date;

  constructor(
    private readonly library: LibrarySource,
    private readonly playback: PlaybackSource,
    private readonly targets: SyncTargets,
    private readonly applier: SyncApplier,
    private readonly options: SyncServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async report(): Promise<SyncPlan> {
    const [library, plays] = await Promise.all([this.library.load(), this.playback.listPlays()]);
    return planSync({
      movies: library.movies,
      series: library.series,
      plays,
      state: loadSyncState(this.targets),
      today: this.now().toISOString().slice(0, 10),
      timeZone: this.options.timeZone,
    });
  }

  async apply(): Promise<{ plan: SyncPlan; result: SyncApplyResult }> {
    const plan = await this.report();
    return { plan, result: this.applier.apply(plan) };
  }
}
