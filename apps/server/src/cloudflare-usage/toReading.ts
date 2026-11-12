import type { UsageReading } from './UsageReading.js';

/** Totals per consumer into a reading with the biggest consumer first. */
export function toReading(totals: Map<string, number>): UsageReading {
  const consumers = [...totals]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return { used: consumers.reduce((sum, c) => sum + c.value, 0), consumers };
}
