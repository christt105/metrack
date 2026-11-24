import type { SeasonEpisodeItem } from './api/SeasonEpisodeItem.js';
import type { Episode } from './Episode.js';
import { episodeKey } from './episodeKey.js';
import type { FillerCategory } from './filler/FillerCategory.js';
import { liveViewings } from './liveViewings.js';
import type { Viewing } from './Viewing.js';

/**
 * One catalog episode as the season's answer lists it, with the user's viewings of it; an episode with only abandoned viewings is not watched. `allWatched` marks every
 * episode that is not skipped as watched, for a completed season that records none of its episodes.
 */
export function toSeasonEpisodeItem(
  episode: Episode,
  seasonNumber: number,
  viewings: readonly Viewing[] | undefined,
  skipped: boolean,
  filler: FillerCategory | null,
  allWatched = false,
): SeasonEpisodeItem {
  return {
    key: episodeKey(episode, seasonNumber),
    number: episode.number,
    tmdbId: episode.tmdbId,
    title: episode.title,
    airDate: episode.airDate,
    runtime: episode.runtime,
    overview: episode.overview,
    stillPath: episode.stillPath,
    watched:
      (allWatched && !skipped) ||
      (viewings !== undefined && (viewings.length === 0 || liveViewings(viewings).length > 0)),
    skipped,
    viewings: viewings === undefined ? [] : [...viewings],
    filler,
  };
}
