import { episodeKey, type NextEpisodeRow } from '@metrack/domain';

/** The key the season episodes endpoint knows the row's episode by; rows without a catalog are marked by number. */
export function nextEpisodeKey(row: NextEpisodeRow): string {
  return (
    row.episode.key ?? episodeKey({ tmdbId: null, number: row.episode.number }, row.season.number)
  );
}
