import type { Series } from '@metrack/domain';
import { readList, readText } from './fieldReaders.js';
import { readArtwork } from './readArtwork.js';
import { readDescriptiveDate } from './readDescriptiveDate.js';
import { readExternalId } from './readExternalId.js';
import type { InlineImage } from './InlineImage.js';
import { readSlug } from './readSlug.js';
import { readTitle } from './readTitle.js';
import { readTracking } from './readTracking.js';
import type { IssueLog } from './IssueLog.js';
import type { PlannedSeries } from './PlannedSeries.js';
import type { PlannedSeason } from './PlannedSeason.js';
import type { VaultNote } from './VaultNote.js';

export function planSeriesEntity(
  note: VaultNote,
  vaultDir: string,
  issues: IssueLog,
  hasSeasonNotes: boolean,
): Omit<PlannedSeries, 'seasons' | 'implicitSeason'> {
  const fm = note.frontmatter;
  const entity: Omit<Series, 'id'> = {
    tmdbId: readExternalId(note, 'tmdb_id', issues),
    tvdbId: readExternalId(note, 'thetvdb_id', issues),
    jellyfinId: null,
    title: readTitle(note, issues),
    originalTitle: readText(fm.original_title),
    firstAirDate: readDescriptiveDate(note, 'release_date', issues),
    overview: readText(fm.overview),
    genres: readList(fm.genres),
    cast: readList(fm.main_actors),
    follow: false,
    note: null,
    cover: null,
    banner: null,
    slug: readSlug(note),
    tags: readList(fm.tags),
    review: hasSeasonNotes && note.body.trim() !== '' ? note.body.trim() : null,
  };
  return { path: note.path, entity, ...readArtwork(note, vaultDir, issues) };
}

/** The single season of a series that has no season notes: its tracking lives on the series note. */
export function planImplicitSeason(
  note: VaultNote,
  series: Omit<Series, 'id'>,
  inline: InlineImage[],
  issues: IssueLog,
): PlannedSeason {
  return {
    path: note.path,
    entity: {
      number: 1,
      tmdbSeasonNumber: 1,
      jellyfinId: null,
      title: null,
      overview: null,
      firstAirDate: series.firstAirDate,
      episodeCount: null,
      cover: null,
      banner: null,
      slug: null,
      tags: readList(note.frontmatter.tags),
      ...readTracking(note, issues),
    },
    cover: null,
    banner: null,
    inline,
  };
}
