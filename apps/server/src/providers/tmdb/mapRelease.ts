import type { TmdbReleaseResponse } from './TmdbReleaseResponse.js';

const REGION = 'ES';
const LIMITED_THEATRICAL = 2;
const THEATRICAL = 3;

/** Only `flatrate` counts: `buy` and `rent` mean the title is not included in a subscription. */
export function hasFlatrateInSpain(response: TmdbReleaseResponse): boolean {
  return (response['watch/providers']?.results?.[REGION]?.flatrate ?? []).length > 0;
}

/** Earliest Spanish premiere or limited release, falling back to the worldwide release date. */
export function movieReleaseDate(response: TmdbReleaseResponse): string | null {
  const spanish = response.release_dates?.results?.find((r) => r.iso_3166_1 === REGION);
  const dates = (spanish?.release_dates ?? [])
    .filter((d) => d.type === THEATRICAL || d.type === LIMITED_THEATRICAL)
    .map((d) => d.release_date.slice(0, 10))
    .sort();
  return dates[0] ?? (response.release_date ? response.release_date : null);
}
