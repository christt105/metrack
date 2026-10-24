import { readList, readText } from './fieldReaders.js';
import { readArtwork } from './readArtwork.js';
import { readDescriptiveDate } from './readDescriptiveDate.js';
import { readTitle } from './readTitle.js';
import { readTracking } from './readTracking.js';
import type { IssueLog } from './IssueLog.js';
import type { PlannedSeason } from './PlannedSeason.js';
import type { VaultNote } from './VaultNote.js';

/** Plans a season from a season note. The vault numbers seasons the way TMDB does. */
export function planSeason(
  note: VaultNote,
  number: number,
  vaultDir: string,
  issues: IssueLog,
): PlannedSeason {
  return {
    path: note.path,
    entity: {
      number,
      tmdbSeasonNumber: number,
      jellyfinId: null,
      title: readTitle(note, issues),
      overview: readText(note.frontmatter.overview),
      firstAirDate: readDescriptiveDate(note, 'release_date', issues),
      episodeCount: null,
      cover: null,
      banner: null,
      slug: note.name,
      tags: readList(note.frontmatter.tags),
      ...readTracking(note, issues),
    },
    ...readArtwork(note, vaultDir, issues),
  };
}

export function hasSeriesTracking(note: VaultNote): boolean {
  const fm = note.frontmatter;
  return (
    readText(fm.date) !== null ||
    readText(fm.rating) !== null ||
    readList(fm.rewatches).length > 0 ||
    note.body.trim() !== '' ||
    (readText(fm.status) !== null && readText(fm.status)?.toLowerCase() !== 'sin empezar')
  );
}
