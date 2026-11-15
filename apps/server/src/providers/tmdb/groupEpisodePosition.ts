import type { TmdbEpisodeGroup } from './TmdbEpisodeGroup.js';

/** Where a TMDB episode sits in an episode group: its season (order) and its place in that season, or null when the group lacks it. */
export function groupEpisodePosition(
  group: TmdbEpisodeGroup,
  seasonNumber: number,
  episodeNumber: number,
): { seasonNumber: number; episodeNumber: number } | null {
  for (const season of group.groups ?? []) {
    const episodes = [...(season.episodes ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = episodes.findIndex(
      (e) => e.season_number === seasonNumber && e.episode_number === episodeNumber,
    );
    if (index >= 0) return { seasonNumber: season.order, episodeNumber: index + 1 };
  }
  return null;
}
