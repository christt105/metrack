import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ImageStore } from '../src/images/ImageStore.js';
import { buildImportPlan } from '../src/importer/buildImportPlan.js';
import { ImportApplier } from '../src/importer/ImportApplier.js';
import { IssueLog } from '../src/importer/IssueLog.js';
import { readVaultNotes } from '../src/importer/readVaultNotes.js';
import {
  BookRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
  VideogameRepository,
} from '../src/storage/repositories/index.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';
import { writeVault } from './support/writeVault.js';

const note = (frontmatter: string, body = ''): string => `---\n${frontmatter}\n---\n${body}`;
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function importVault(files: Record<string, string | Buffer>) {
  const vaultDir = writeVault(files);
  const storeDir = mkdtempSync(join(tmpdir(), 'metrack-store-'));
  dirs.push(vaultDir, storeDir);
  const db = openTestDatabase();
  const targets = {
    movies: new MovieRepository(db),
    series: new SeriesRepository(db),
    seasons: new SeasonRepository(db),
    videogames: new VideogameRepository(db),
    books: new BookRepository(db),
    unlinked: new UnlinkedTitleRepository(db),
  };
  const issues = new IssueLog();
  const plan = buildImportPlan(readVaultNotes(vaultDir, issues), vaultDir, issues);
  const store = new ImageStore(db, storeDir);
  await new ImportApplier(db, targets, store).apply(plan);
  return { targets, store, issues };
}

describe('import of export fields', () => {
  it('keeps note names as slugs and tags on every kind', async () => {
    const { targets } = await importVault({
      'Movies/Alpha (2020).md': note(
        'title: Alpha\ntype: movie\ntmdb_id: 1\ntags:\n  - cine',
        'Review.',
      ),
      'TVs/Show (2020).md': note('title: Show\ntype: tv\ntmdb_id: 2\ntags:\n  - anime'),
      'Seasons/Show - S1.md': note(
        'title: S1\ntype: season\nseries: "[[Show (2020)]]"\nseason_number: 1\ntags: anime',
      ),
      'TVs/Solo (2021).md': note('title: Solo\ntype: tv\ntmdb_id: 3\ntags:\n  - drama', 'Body.'),
      'Juegos/Game.md': note('title: Game\ntype: videogame\nigdb_id: 4\ntags:\n  - rpg'),
    });
    expect(targets.movies.findByTmdbId(1)).toMatchObject({ slug: 'Alpha (2020)', tags: ['cine'] });
    expect(targets.series.findByTmdbId(2)).toMatchObject({ slug: 'Show (2020)', tags: ['anime'] });
    const show = targets.series.findByTmdbId(2)!;
    expect(targets.seasons.listBySeries(show.id)[0]).toMatchObject({
      slug: 'Show - S1',
      tags: ['anime'],
    });
    const solo = targets.series.findByTmdbId(3)!;
    expect(targets.seasons.listBySeries(solo.id)[0]).toMatchObject({
      slug: null,
      tags: ['drama'],
      review: 'Body.',
    });
    expect(show.review).toBeNull();
    expect(targets.videogames.findByIgdbId(4)).toMatchObject({ slug: 'Game', tags: ['rpg'] });
  });

  it('stores no slug for a note name that is not a safe folder name', async () => {
    const { targets } = await importVault({
      'Movies/Part #1: Origins.md': note('title: Origins\ntype: movie\ntmdb_id: 1'),
      'Movies/Amélie (2001).md': note('title: Amélie\ntype: movie\ntmdb_id: 2'),
    });
    expect(targets.movies.findByTmdbId(1)?.slug).toBeNull();
    expect(targets.movies.findByTmdbId(2)?.slug).toBe('Amélie (2001)');
  });

  it('keeps the review of a series that has season notes on the series', async () => {
    const { targets } = await importVault({
      'TVs/Show (2020).md': note(
        'title: Show\ntype: tv\ntmdb_id: 2\nstatus: Acabado\nrating: 7',
        'My thoughts.',
      ),
      'Seasons/Show - S1.md': note(
        'title: S1\ntype: season\nseries: "[[Show (2020)]]"\nseason_number: 1',
      ),
    });
    expect(targets.series.findByTmdbId(2)?.review).toBe('My thoughts.');
  });

  it('stores images embedded in a review and rewrites the embed to the stored reference', async () => {
    const { targets, store, issues } = await importVault({
      'Files/Shot.png': png(10, 10),
      'Movies/Alpha (2020).md': note(
        'title: Alpha\ntype: movie\ntmdb_id: 1',
        'Before ![[Media Tracker/Files/Shot.png]] after ![[Missing.png]]',
      ),
    });
    const movie = targets.movies.findByTmdbId(1)!;
    const [image] = store.list();
    expect(movie.review).toBe(`Before ![Shot.png](${image!.ref}) after ![[Missing.png]]`);
    expect(issues.all().map((issue) => issue.code)).toContain('missing-image');
  });
});
