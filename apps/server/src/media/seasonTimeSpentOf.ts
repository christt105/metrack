import {
  episodeKey,
  seasonTimeSpent,
  type EpisodeWatches,
  type Season,
  type SeasonEpisodes,
  type Series,
  type TimeSpent,
} from '@metrack/domain';

/** The time spent on a season from its catalog, if it has one, and what the user watched and skipped of its series. */
export function seasonTimeSpentOf(
  season: Season,
  series: Pick<Series, 'episodeRuntime'> | undefined,
  catalog: SeasonEpisodes | undefined,
  watched: EpisodeWatches,
  skipped: readonly string[],
): TimeSpent | null {
  return seasonTimeSpent({
    episodes:
      catalog === undefined
        ? null
        : catalog.episodes.map((episode) => ({
            key: episodeKey(episode, season.number),
            runtime: episode.runtime,
          })),
    watches: watched,
    skipped: new Set(skipped),
    seriesRuntime: series?.episodeRuntime ?? null,
    watchedCount: season.watchedCount,
    finishedAt: season.finishedAt,
  });
}
