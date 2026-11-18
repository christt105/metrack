import type { OrderedEpisode } from '@metrack/domain';
import { mapGroupSeasonEpisodes, mapSeasonEpisodes } from '../providers/tmdb/mapSeasonEpisodes.js';
import { mapGroupSeasons } from '../providers/tmdb/mapGroupSeasons.js';
import { mapRegularSeasons } from '../providers/tmdb/mapRegularSeasons.js';
import type { TmdbClient } from '../providers/tmdb/TmdbClient.js';
import type { SeriesOrdering } from './SeriesOrdering.js';

function ordered(
  seasonNumber: number,
  episodes: readonly { number: number; tmdbId: number | null; airDate: string | null }[],
): OrderedEpisode[] {
  return episodes.flatMap((episode) =>
    episode.tmdbId === null
      ? []
      : [
          {
            tmdbId: episode.tmdbId,
            seasonNumber,
            number: episode.number,
            airDate: episode.airDate,
          },
        ],
  );
}

/**
 * The ordering TMDB gives a series: the seasons of its episode group when it follows one, else its regular
 * seasons, each with its episodes numbered the way metrack numbers them (see `mapGroupSeasonEpisodes`).
 */
export async function loadSeriesOrdering(
  tmdb: TmdbClient,
  tmdbId: number,
  episodeGroup: string | null,
): Promise<SeriesOrdering> {
  if (episodeGroup !== null) {
    const group = await tmdb.episodeGroup(episodeGroup);
    const seasons = mapGroupSeasons(group);
    return {
      seasons: seasons.map(({ number, title, firstAirDate }) => ({ number, title, firstAirDate })),
      episodes: seasons.flatMap((season) =>
        ordered(season.number, mapGroupSeasonEpisodes(group, season.number) ?? []),
      ),
    };
  }
  const seasons = mapRegularSeasons((await tmdb.tv(tmdbId)).seasons);
  const documents = await tmdb.seasonsOf(
    tmdbId,
    seasons.map((season) => season.number),
  );
  return {
    seasons: seasons.map(({ number, title, firstAirDate }) => ({ number, title, firstAirDate })),
    episodes: seasons.flatMap((season) => {
      const document = documents.get(season.number);
      return document ? ordered(season.number, mapSeasonEpisodes(document)) : [];
    }),
  };
}
