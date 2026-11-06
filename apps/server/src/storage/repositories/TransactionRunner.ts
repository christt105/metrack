/** Runs a unit of work atomically: every write inside it is kept, or none is. */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}
