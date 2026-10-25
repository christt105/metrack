import type { JellyfinItem } from './JellyfinItem.js';

/** A numeric provider id such as `Tmdb` or `Tvdb`, or null when absent or not a number. */
export function providerId(item: JellyfinItem, provider: string): number | null {
  const raw = item.ProviderIds?.[provider];
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}
