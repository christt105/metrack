/** Runs a callback once after a delay. */
export interface Scheduler {
  schedule(callback: () => void, delayMs: number): void;
}
