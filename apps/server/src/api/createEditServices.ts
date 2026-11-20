import { ArtworkService } from '../artwork/ArtworkService.js';
import { buildMediaKinds } from '../media/buildMediaKinds.js';
import { FillerListClient } from '../filler/FillerListClient.js';
import { FillerService } from '../filler/FillerService.js';
import { MediaCatalog } from '../media/MediaCatalog.js';
import { MediaEditor } from '../media/MediaEditor.js';
import { EpisodeGroupService } from '../seasons/EpisodeGroupService.js';
import { SeasonRefresher } from '../seasons/SeasonRefresher.js';
import { SeasonEpisodesService } from '../seasons/SeasonEpisodesService.js';
import { UnlinkedResolver } from '../titles/UnlinkedResolver.js';
import type { EditServices } from './EditServices.js';
import type { EditServicesDeps } from './EditServicesDeps.js';

export function createEditServices(deps: EditServicesDeps): EditServices {
  const { sources } = deps;
  const kinds = buildMediaKinds(sources, deps.seasonEpisodes);
  const editor = new MediaEditor(kinds, deps.states, deps.images, deps.now);
  const seasonEpisodes = new SeasonEpisodesService({
    seasons: sources.seasons,
    series: sources.series,
    catalog: deps.seasonEpisodes,
    watches: deps.episodeWatches,
    ...(deps.tmdb ? { tmdb: deps.tmdb } : {}),
    ...(deps.now ? { now: deps.now } : {}),
  });
  return {
    editor,
    catalog: new MediaCatalog(kinds),
    artwork: new ArtworkService(editor, sources.series, deps.imageProviders, deps.images),
    titleProviders: deps.titleProviders,
    resolver: new UnlinkedResolver(deps.unlinked, editor, deps.titleProviders, deps.cache),
    series: sources.series,
    unlinked: deps.unlinked,
    seasonEpisodes,
    filler: new FillerService({
      series: sources.series,
      seasons: sources.seasons,
      episodes: seasonEpisodes,
      list: new FillerListClient(deps.fetchFn),
    }),
    ...(deps.tmdb
      ? {
          episodeGroups: new EpisodeGroupService(
            deps.tmdb,
            sources.series,
            sources.seasons,
            deps.cache,
            new SeasonRefresher(deps.tmdb, sources.seasons, deps.images, deps.seasonEpisodes),
            seasonEpisodes,
          ),
        }
      : {}),
  };
}
