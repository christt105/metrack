import { readInteger, readText } from './fieldReaders.js';
import { hasSeriesTracking, planSeason } from './planSeason.js';
import { planBook } from './planBook.js';
import { planImplicitSeason, planSeriesEntity } from './planSeries.js';
import { planMovie } from './planMovie.js';
import { planVideogame } from './planVideogame.js';
import { reportUnknownFields } from './reportUnknownFields.js';
import { wikilinkTarget } from './wikilinkTarget.js';
import { yearOf } from './yearOf.js';
import { IssueLog } from './IssueLog.js';
import type { ImportPlan } from './ImportPlan.js';
import type { NoteKind } from './NoteKind.js';
import type { PlannedSeason } from './PlannedSeason.js';
import type { PlannedSeries } from './PlannedSeries.js';
import type { PlannedUnlinked } from './PlannedUnlinked.js';
import type { VaultNote } from './VaultNote.js';

/**
 * Turns parsed notes into the rows an import would write. Pure apart from checking that local
 * image files exist; nothing is written.
 */
export function buildImportPlan(
  notes: VaultNote[],
  vaultDir: string,
  preIssues = new IssueLog(),
): ImportPlan {
  const issues = preIssues;
  const byKind = (kind: NoteKind): VaultNote[] => notes.filter((note) => note.kind === kind);
  const unlinked: PlannedUnlinked[] = [];
  const notesRead: Record<string, number> = {};
  for (const note of notes) {
    notesRead[note.kind] = (notesRead[note.kind] ?? 0) + 1;
    reportUnknownFields(note, issues);
  }

  const movieKeys = new Set<number>();
  const movies: ImportPlan['movies'] = [];
  for (const note of byKind('movie')) {
    const planned = planMovie(note, vaultDir, issues);
    const key = planned.entity.tmdbId;
    if (key === null) {
      issues.add('missing-id', note.path, 'tmdb_id');
      unlinked.push(toUnlinked('movie', planned.entity.title, planned.entity.releaseDate, note));
    } else if (movieKeys.has(key)) {
      issues.add('duplicate-key', note.path, `tmdb_id ${key}`);
      unlinked.push(toUnlinked('movie', planned.entity.title, planned.entity.releaseDate, note));
    } else {
      movieKeys.add(key);
      movies.push(planned);
    }
  }

  const videogameKeys = new Set<string>();
  const videogames: ImportPlan['videogames'] = [];
  for (const note of byKind('videogame')) {
    const planned = planVideogame(note, vaultDir, issues);
    const { igdbId, steamAppId } = planned.entity;
    const key =
      igdbId !== null ? `igdb:${igdbId}` : steamAppId !== null ? `steam:${steamAppId}` : null;
    if (key === null) {
      issues.add('missing-id', note.path, 'igdb_id');
      unlinked.push(
        toUnlinked('videogame', planned.entity.title, planned.entity.releaseDate, note),
      );
    } else if (videogameKeys.has(key)) {
      issues.add('duplicate-key', note.path, key);
      unlinked.push(
        toUnlinked('videogame', planned.entity.title, planned.entity.releaseDate, note),
      );
    } else {
      videogameKeys.add(key);
      videogames.push(planned);
    }
  }

  const bookKeys = new Set<string>();
  const books: ImportPlan['books'] = [];
  for (const note of byKind('book')) {
    const planned = planBook(note, vaultDir, issues);
    const { openLibraryId, isbn } = planned.entity;
    const key =
      openLibraryId !== null ? `ol:${openLibraryId}` : isbn !== null ? `isbn:${isbn}` : null;
    if (key === null) {
      issues.add('missing-id', note.path, 'openlibrary_id');
      unlinked.push(toUnlinked('book', planned.entity.title, planned.entity.releaseDate, note));
    } else if (bookKeys.has(key)) {
      issues.add('duplicate-key', note.path, key);
      unlinked.push(toUnlinked('book', planned.entity.title, planned.entity.releaseDate, note));
    } else {
      bookKeys.add(key);
      books.push(planned);
    }
  }

  const seasonNotesBySeries = new Map<string, VaultNote[]>();
  const tvNames = new Set(byKind('tv').map((note) => note.name));
  const orphanSeasons: VaultNote[] = [];
  for (const note of byKind('season')) {
    const target = wikilinkTarget(note.frontmatter.series);
    if (target === null || !tvNames.has(target)) {
      orphanSeasons.push(note);
      continue;
    }
    seasonNotesBySeries.set(target, [...(seasonNotesBySeries.get(target) ?? []), note]);
  }

  const seriesKeys = new Set<string>();
  const unlinkedSeriesNames = new Set<string>();
  const series: PlannedSeries[] = [];
  for (const note of byKind('tv')) {
    const base = planSeriesEntity(note, vaultDir, issues);
    const { tmdbId, tvdbId } = base.entity;
    const key = tmdbId !== null ? `tmdb:${tmdbId}` : tvdbId !== null ? `tvdb:${tvdbId}` : null;
    const seasonNotes = seasonNotesBySeries.get(note.name) ?? [];
    if (key === null) {
      issues.add('missing-id', note.path, 'tmdb_id');
      unlinked.push(toUnlinked('series', base.entity.title, base.entity.firstAirDate, note));
      unlinkedSeriesNames.add(note.name);
      orphanSeasons.push(...seasonNotes);
      continue;
    }
    if (seriesKeys.has(key)) {
      issues.add('duplicate-key', note.path, key);
      unlinked.push(toUnlinked('series', base.entity.title, base.entity.firstAirDate, note));
      orphanSeasons.push(...seasonNotes);
      continue;
    }
    seriesKeys.add(key);

    const seasons: PlannedSeason[] = [];
    const numbers = new Set<number>();
    for (const seasonNote of seasonNotes) {
      const number = readInteger(seasonNote.frontmatter.season_number);
      if (number.value === null) {
        issues.add(
          'missing-season-number',
          seasonNote.path,
          String(seasonNote.frontmatter.season_number ?? ''),
        );
      } else if (numbers.has(number.value)) {
        issues.add('duplicate-season', seasonNote.path, `season ${number.value}`);
        unlinked.push(
          toUnlinked(
            'season',
            readText(seasonNote.frontmatter.title) ?? seasonNote.name,
            null,
            seasonNote,
          ),
        );
      } else {
        numbers.add(number.value);
        seasons.push(planSeason(seasonNote, number.value, vaultDir, issues));
      }
    }
    seasons.sort((a, b) => a.entity.number - b.entity.number);

    const implicitSeason = seasonNotes.length === 0;
    if (implicitSeason) seasons.push(planImplicitSeason(note, base.entity, issues));
    else if (hasSeriesTracking(note)) issues.add('series-tracking-ignored', note.path);
    series.push({ ...base, seasons, implicitSeason });
  }

  for (const note of orphanSeasons) {
    const target = wikilinkTarget(note.frontmatter.series);
    const reason =
      target === null
        ? 'no series link'
        : unlinkedSeriesNames.has(target)
          ? `series unlinked: ${target}`
          : `series not found: ${target}`;
    issues.add('orphan-season', note.path, reason);
    unlinked.push(toUnlinked('season', readText(note.frontmatter.title) ?? note.name, null, note));
  }

  return { movies, series, videogames, books, unlinked, issues: issues.all(), notesRead };
}

function toUnlinked(
  mediaType: PlannedUnlinked['mediaType'],
  title: string,
  date: string | null,
  note: VaultNote,
): PlannedUnlinked {
  return { mediaType, title, year: yearOf(date), path: note.path };
}
