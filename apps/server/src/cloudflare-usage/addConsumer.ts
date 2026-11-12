/** Adds a value under a name, creating the entry when new. */
export function addConsumer(totals: Map<string, number>, name: string, value: number): void {
  totals.set(name, (totals.get(name) ?? 0) + value);
}
