import type { Scheduler } from '../../src/publish/Scheduler.js';

/** Collects scheduled callbacks so a test decides when they fire. */
export class FakeScheduler implements Scheduler {
  readonly delays: number[] = [];
  private readonly callbacks: (() => void)[] = [];

  schedule(callback: () => void, delayMs: number): void {
    this.delays.push(delayMs);
    this.callbacks.push(callback);
  }

  /** Fires the oldest pending callback and lets promises settle. */
  async fire(): Promise<void> {
    const callback = this.callbacks.shift();
    if (!callback) throw new Error('Nothing scheduled');
    callback();
    await new Promise((resolve) => setImmediate(resolve));
  }

  pending(): number {
    return this.callbacks.length;
  }
}
