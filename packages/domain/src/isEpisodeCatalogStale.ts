const DAY_MS = 24 * 60 * 60 * 1000;

/** A catalog of a season that is airing is refreshed after a day, any other after 30 days; a missing one is stale. */
export function isEpisodeCatalogStale(
  fetchedAt: string | null,
  now: Date,
  airing: boolean,
): boolean {
  if (fetchedAt === null) return true;
  const fetched = Date.parse(fetchedAt);
  if (Number.isNaN(fetched)) return true;
  return now.getTime() - fetched >= (airing ? 1 : 30) * DAY_MS;
}
