import type { Season } from '@metrack/domain';

/**
 * The season whose tracking lives on the series page: a series with exactly one season that has
 * no note of its own. Returns null when the series has season pages.
 */
export function inlineSeasonOf(seasons: Season[]): Season | null {
  const [only] = seasons;
  return seasons.length === 1 && only !== undefined && only.slug === null ? only : null;
}
