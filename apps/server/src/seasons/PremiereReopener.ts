import {
  episodeKey,
  idEpisodeWatches,
  reopenCompletedSeason,
  type Episode,
  type Season,
} from '@metrack/domain';
import type { SeasonRepository } from '../storage/repositories/SeasonRepository.js';

/**
 * Sets the users' completed entries of a season back to in progress when its catalog gains an episode, or an
 * episode gets the date it airs on, that has aired and they neither watched nor skipped (see `reopenCompletedSeason`). Entries whose status is not derived
 * from episodes are left alone. The catalog is shared, so this runs for every user who has the season, and answers how many entries it reopened.
 */
export class PremiereReopener {
  constructor(
    private readonly seasons: SeasonRepository,
    private readonly now: () => Date,
  ) {}

  async reopen(
    season: Season,
    before: readonly Episode[],
    after: readonly Episode[],
  ): Promise<number> {
    const known = new Map(
      before.map((episode) => [episodeKey(episode, season.number), episode.airDate] as const),
    );
    const today = this.now().toISOString().slice(0, 10);
    const gained = after.some(
      (episode) =>
        known.get(episodeKey(episode, season.number)) !== episode.airDate &&
        episode.airDate !== null &&
        episode.airDate <= today,
    );
    if (!gained) return 0;
    const expected = after.map((episode) => ({
      key: episodeKey(episode, season.number),
      airDate: episode.airDate,
    }));
    const reopened: number[] = [];
    for (const entry of await this.seasons.listCompletedEntries(season.id)) {
      const watches = idEpisodeWatches(after, season.number, entry.watched);
      if (reopenCompletedSeason(entry.tracking, expected, watches, new Set(entry.skipped), today)) {
        reopened.push(entry.userId);
      }
    }
    await this.seasons.reopenEntries(season.id, reopened);
    return reopened.length;
  }
}
