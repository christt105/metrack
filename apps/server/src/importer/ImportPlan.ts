import type { Book, Movie, Videogame } from '@metrack/domain';
import type { ImportIssue } from './ImportIssue.js';
import type { PlannedEntity } from './PlannedEntity.js';
import type { PlannedSeries } from './PlannedSeries.js';
import type { PlannedUnlinked } from './PlannedUnlinked.js';

/** Everything an import run would write, derived from the notes alone. */
export interface ImportPlan {
  movies: PlannedEntity<Omit<Movie, 'id'>>[];
  series: PlannedSeries[];
  videogames: PlannedEntity<Omit<Videogame, 'id'>>[];
  books: PlannedEntity<Omit<Book, 'id'>>[];
  unlinked: PlannedUnlinked[];
  issues: ImportIssue[];
  /** Notes read per kind, whether or not they could be imported. */
  notesRead: Record<string, number>;
}
