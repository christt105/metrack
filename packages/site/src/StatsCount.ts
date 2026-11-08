import type { PublicEntry } from './PublicEntry.js';

/** A finished item counted once, plus once for each rewatch. */
export function completions(entry: PublicEntry): number {
  return 1 + entry.rewatches.length;
}

/** Counts how many times each name appears, most frequent first and alphabetical among equals. */
export function countNames(names: string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
