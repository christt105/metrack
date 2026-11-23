import {
  buildNextEpisodeRow,
  latestViewingDate,
  pickNextSeason,
  type NextEpisodeRow,
  type NextEpisodesResponse,
  type NextSeasonPick,
  type Season,
} from '@metrack/domain';
import { isHiddenFromNext } from './isHiddenFromNext.js';
import type { NextEpisodesDeps } from './NextEpisodesDeps.js';

interface Candidate {
  seriesId: number;
  pick: NextSeasonPick;
}

/**
 * The episode that is next for each series of the user. Series are chosen from their season entries first, so the
 * watches, the catalog and the filler classification are only read for the picked season of a series that has
 * something to watch. Nothing is fetched from a provider: a season without a stored catalog answers by number.
 */
export class NextEpisodesService {
  private readonly now: () => Date;

  constructor(private readonly deps: NextEpisodesDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** The rows for every series of the user, or only the one of `seriesId` (an empty list when it has none). */
  async list(seriesId?: number): Promise<NextEpisodesResponse> {
    const seasons =
      seriesId === undefined
        ? await this.deps.seasons.list()
        : await this.deps.seasons.listBySeries(seriesId);
    const hidden = await this.deps.series.listNextHidden();
    const today = this.now().toISOString().slice(0, 10);
    const candidates = this.candidates(seasons, today);
    const series = new Map(
      (await this.deps.series.getMany(candidates.map((c) => c.seriesId))).map((s) => [s.id, s]),
    );
    const rows: { row: NextEpisodeRow; viewed: string | null }[] = [];
    for (const { seriesId: id, pick } of candidates) {
      const owner = series.get(id);
      if (!owner) continue;
      const entry = await this.deps.watches.getEntry(id);
      if (isHiddenFromNext(hidden.get(id), entry?.lastActivityAt ?? null)) continue;
      const watches = entry?.watched ?? {};
      const catalog = await this.deps.catalog.get(pick.season.id);
      const row = buildNextEpisodeRow({
        series: owner,
        pick,
        catalog:
          catalog?.complete === true && catalog.episodes.length > 0
            ? { episodes: catalog.episodes, source: catalog.source }
            : undefined,
        watches,
        skipped: entry?.skipped ?? [],
        filler:
          catalog === undefined
            ? {}
            : ((await this.deps.filler.get(pick.season.id))?.categories ?? {}),
        today,
        lastActivityAt: entry?.lastActivityAt ?? null,
      });
      if (row) rows.push({ row, viewed: latestViewingDate(watches) });
    }
    rows.sort((a, b) => compare(a, b));
    return { rows: rows.map((r) => r.row) };
  }

  /** Takes the series off the list until something of it is marked or skipped; false when it is not in the library. */
  async hide(seriesId: number): Promise<boolean> {
    return this.deps.series.setNextHidden(seriesId, this.now().toISOString());
  }

  /** Puts a series taken off the list back; false when it is not in the library. */
  async unhide(seriesId: number): Promise<boolean> {
    return this.deps.series.setNextHidden(seriesId, null);
  }

  private candidates(seasons: readonly Season[], today: string): Candidate[] {
    const bySeries = new Map<number, Season[]>();
    for (const season of seasons) {
      const list = bySeries.get(season.seriesId) ?? [];
      list.push(season);
      bySeries.set(season.seriesId, list);
    }
    const found: Candidate[] = [];
    for (const [seriesId, own] of bySeries) {
      const pick = pickNextSeason(own, today);
      if (pick) found.push({ seriesId, pick });
    }
    return found;
  }
}

function compare(
  a: { row: NextEpisodeRow; viewed: string | null },
  b: { row: NextEpisodeRow; viewed: string | null },
): number {
  const left = a.row.lastActivityAt;
  const right = b.row.lastActivityAt;
  if (left !== null && right !== null) return left < right ? 1 : left > right ? -1 : 0;
  if (left !== null) return -1;
  if (right !== null) return 1;
  const viewedLeft = a.viewed ?? '';
  const viewedRight = b.viewed ?? '';
  return viewedLeft < viewedRight ? 1 : viewedLeft > viewedRight ? -1 : 0;
}
