/**
 * The key a user's watches use for an episode: its TMDB id as a string, or `s<season>e<episode>` in metrack's
 * numbering when it has no id.
 */
export function episodeKey(
  episode: { tmdbId: number | null; number: number },
  seasonNumber: number,
): string {
  return episode.tmdbId !== null ? String(episode.tmdbId) : `s${seasonNumber}e${episode.number}`;
}
