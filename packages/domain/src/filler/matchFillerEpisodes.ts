import { episodeKey } from '../episodeKey.js';
import type { FillerEntry } from './FillerEntry.js';
import type { FillerMatch } from './FillerMatch.js';
import type { FillerSeason } from './FillerSeason.js';

/**
 * Pairs the list with the series' episodes by absolute number: the seasons numbered 1 or more in season order,
 * each with its episodes in catalog order, one after another. The pairing is only trusted when both sides have
 * the same number of episodes and the list numbers them 1 to N without gaps.
 */
export function matchFillerEpisodes(
  entries: readonly FillerEntry[],
  seasons: readonly FillerSeason[],
): FillerMatch {
  const ordered = seasons
    .filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const ours = ordered.reduce((sum, season) => sum + season.episodes.length, 0);
  if (ours !== entries.length) {
    return { ok: false, code: 'filler_count_mismatch', ours, theirs: entries.length };
  }
  if (entries.some((entry, index) => entry.number !== index + 1)) {
    return { ok: false, code: 'filler_list_invalid', ours, theirs: entries.length };
  }
  const episodes = ordered.flatMap((season) =>
    season.episodes.map((episode) => ({ season, episode })),
  );
  return {
    ok: true,
    episodes: episodes.map(({ season, episode }, index) => ({
      seasonId: season.seasonId,
      seasonNumber: season.seasonNumber,
      key: episodeKey(episode, season.seasonNumber),
      number: episode.number,
      title: episode.title,
      absoluteNumber: index + 1,
      category: entries[index]!.category,
    })),
  };
}
