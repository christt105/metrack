import type { Scheduler } from './Scheduler.js';

export class TimerScheduler implements Scheduler {
  schedule(callback: () => void, delayMs: number): void {
    setTimeout(callback, delayMs).unref();
  }
}
