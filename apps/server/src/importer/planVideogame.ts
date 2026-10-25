import type { Videogame } from '@metrack/domain';
import { readList, readText } from './fieldReaders.js';
import { readArtwork } from './readArtwork.js';
import { readDescriptiveDate } from './readDescriptiveDate.js';
import { readExternalId } from './readExternalId.js';
import { readTitle } from './readTitle.js';
import { readTracking } from './readTracking.js';
import type { IssueLog } from './IssueLog.js';
import type { PlannedEntity } from './PlannedEntity.js';
import type { VaultNote } from './VaultNote.js';

export function planVideogame(
  note: VaultNote,
  vaultDir: string,
  issues: IssueLog,
): PlannedEntity<Omit<Videogame, 'id'>> {
  const fm = note.frontmatter;
  const entity: Omit<Videogame, 'id'> = {
    igdbId: readExternalId(note, 'igdb_id', issues),
    steamAppId: readText(fm.steam_appid),
    steamGridDbId: readExternalId(note, 'steamgriddb_id', issues),
    title: readTitle(note, issues),
    releaseDate: readDescriptiveDate(note, 'release_date', issues),
    overview: readText(fm.overview),
    genres: readList(fm.genres),
    developer: readText(fm.developer),
    platforms: readList(fm.platforms),
    note: null,
    cover: null,
    banner: null,
    ...readTracking(note, issues),
  };
  return { path: note.path, entity, ...readArtwork(note, vaultDir, issues) };
}
