import type { Movie } from '@metrack/domain';
import { readList, readText } from './fieldReaders.js';
import { readArtwork } from './readArtwork.js';
import { readDescriptiveDate } from './readDescriptiveDate.js';
import { readExternalId } from './readExternalId.js';
import { readTitle } from './readTitle.js';
import { readTracking } from './readTracking.js';
import type { IssueLog } from './IssueLog.js';
import type { PlannedEntity } from './PlannedEntity.js';
import type { VaultNote } from './VaultNote.js';

export function planMovie(
  note: VaultNote,
  vaultDir: string,
  issues: IssueLog,
): PlannedEntity<Omit<Movie, 'id'>> {
  const fm = note.frontmatter;
  const entity: Omit<Movie, 'id'> = {
    tmdbId: readExternalId(note, 'tmdb_id', issues),
    jellyfinId: null,
    title: readTitle(note, issues),
    originalTitle: readText(fm.original_title),
    releaseDate: readDescriptiveDate(note, 'release_date', issues),
    overview: readText(fm.overview),
    genres: readList(fm.genres),
    cast: readList(fm.main_actors),
    director: readText(fm.director),
    note: null,
    cover: null,
    banner: null,
    ...readTracking(note, issues),
  };
  return { path: note.path, entity, ...readArtwork(note, vaultDir, issues) };
}
