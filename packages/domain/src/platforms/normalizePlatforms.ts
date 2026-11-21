import { canonicalPlatform } from './canonicalPlatform.js';

/** Canonical names without blanks or repeats, in their first-seen order. */
export function normalizePlatforms(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const canonical = canonicalPlatform(name);
    if (canonical === '' || seen.has(canonical)) continue;
    seen.add(canonical);
    result.push(canonical);
  }
  return result;
}
