import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImageStore } from '../src/images/ImageStore.js';
import { buildImportPlan } from '../src/importer/buildImportPlan.js';
import { formatReport } from '../src/importer/formatReport.js';
import { ImportApplier } from '../src/importer/ImportApplier.js';
import { IssueLog } from '../src/importer/IssueLog.js';
import { parseDate } from '../src/importer/parseDate.js';
import { parseFrontmatter } from '../src/importer/parseFrontmatter.js';
import { parseRating } from '../src/importer/parseRating.js';
import { parseStatus } from '../src/importer/parseStatus.js';
import { readVaultNotes } from '../src/importer/readVaultNotes.js';
import { runImport } from '../src/importer/runImport.js';
import type { ImportPlan } from '../src/importer/ImportPlan.js';
import {
  BookRepository,
  MovieRepository,
  SeasonRepository,
  SeriesRepository,
  UnlinkedTitleRepository,
  VideogameRepository,
} from '../src/storage/repositories/index.js';
import { png } from './support/sampleImages.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { REMOTE_COVER, syntheticVault } from './support/syntheticVault.js';
import { writeVault } from './support/writeVault.js';

const created: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-import-'));
  created.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function planFor(vaultDir: string): ImportPlan {
  created.push(vaultDir);
  const issues = new IssueLog();
  return buildImportPlan(readVaultNotes(vaultDir, issues), vaultDir, issues);
}

describe('field parsing', () => {
  it('splits frontmatter and body', () => {
    const parsed = parseFrontmatter('---\ntitle: "A: b"\ngenres:\n  - X\n---\nBody\n');
    expect(parsed.frontmatter).toEqual({ title: 'A: b', genres: ['X'] });
    expect(parsed.body).toBe('Body\n');
  });

  it('keeps dates as strings', () => {
    expect(parseFrontmatter('---\ndate: 2024-08-27\n---\n').frontmatter.date).toBe('2024-08-27');
  });

  it('maps plugin statuses to model statuses', () => {
    expect(parseStatus('Acabado').value).toBe('completed');
    expect(parseStatus('En Curso').value).toBe('in_progress');
    expect(parseStatus('Pausado').value).toBe('paused');
    expect(parseStatus('Abandonado').value).toBe('dropped');
    expect(parseStatus('Sin Empezar').value).toBe('planned');
    expect(parseStatus('Not Started').value).toBe('planned');
    expect(parseStatus('Soon').problem).toBe('unknown');
    expect(parseStatus('').problem).toBe('missing');
  });

  it('validates dates and ratings', () => {
    expect(parseDate('2024-02-29')).toEqual({ value: '2024-02-29', odd: false });
    expect(parseDate('2023-02-29').odd).toBe(true);
    expect(parseDate('31/12/2023').odd).toBe(true);
    expect(parseDate('')).toEqual({ value: null, odd: false });
    expect(parseRating('7')).toEqual({ value: 7, odd: false });
    expect(parseRating(6.5).value).toBe(6.5);
    expect(parseRating('11').odd).toBe(true);
    expect(parseRating('')).toEqual({ value: null, odd: false });
  });
});

describe('buildImportPlan', () => {
  const plan = planFor(writeVault(syntheticVault()));
  const codes = (code: string): string[] =>
    plan.issues.filter((i) => i.code === code).map((i) => i.path);

  it('counts entities per type', () => {
    expect(plan.movies.map((m) => m.entity.title)).toEqual(['Alpha', 'Beta']);
    expect(plan.series.map((s) => s.entity.title)).toEqual(['Delta', 'Epsilon', 'Zeta']);
    expect(plan.videogames.map((g) => g.entity.title)).toEqual(['Hollow', 'Steam Only']);
    expect(plan.books.map((b) => b.entity.title)).toEqual(['Book One']);
    expect(plan.series.flatMap((s) => s.seasons)).toHaveLength(4);
  });

  it('maps tracking and moves date to finished_at', () => {
    const alpha = plan.movies[0]!.entity;
    expect(alpha).toMatchObject({
      status: 'completed',
      finishedAt: '2024-03-05',
      rating: 7,
      rewatches: ['2025-01-02'],
      review: 'Great film.',
      overview: null,
      startedAt: null,
    });
  });

  it('turns a series without season notes into a series with one season', () => {
    const delta = plan.series.find((s) => s.entity.title === 'Delta')!;
    expect(delta.implicitSeason).toBe(true);
    expect(delta.seasons).toHaveLength(1);
    expect(delta.seasons[0]!.entity).toMatchObject({
      number: 1,
      status: 'completed',
      finishedAt: '2023-02-02',
      rating: 6,
    });
    expect(delta.entity.tvdbId).toBe(900);
  });

  it('keeps explicit seasons ordered and resolves aliased and path wikilinks', () => {
    const zeta = plan.series.find((s) => s.entity.title === 'Zeta')!;
    expect(zeta.implicitSeason).toBe(false);
    expect(zeta.seasons.map((s) => [s.entity.number, s.entity.status])).toEqual([
      [1, 'completed'],
      [3, 'in_progress'],
    ]);
    expect(zeta.seasons[0]!.entity.rating).toBe(8);
  });

  it('reports each kind of problem', () => {
    expect(codes('unknown-field')).toEqual(['Movies/Beta (2021).md']);
    expect(codes('odd-date')).toContain('Movies/Gamma (2022).md');
    expect(codes('odd-rating')).toEqual(['Movies/Gamma (2022).md']);
    expect(codes('unknown-status')).toEqual(['Movies/Gamma (2022).md']);
    expect(codes('duplicate-key').sort()).toEqual([
      'Juegos/Hollow Demo.md',
      'Movies/Alpha Again.md',
    ]);
    expect(codes('duplicate-season')).toEqual(['Seasons/Zeta - Season 3 again.md']);
    expect(codes('missing-season-number')).toEqual(['Seasons/No Number.md']);
    expect(codes('orphan-season').sort()).toEqual([
      'Seasons/Lost - Season 1.md',
      'Seasons/Nameless - Season 1.md',
    ]);
    expect(codes('series-tracking-ignored')).toEqual(['TVs/Zeta (2018).md']);
    expect(codes('parse-error')).toEqual(['Misc/Broken.md']);
    expect(codes('unknown-type')).toEqual(['Misc/NoType.md']);
    expect(codes('completed-without-date')).toContain('Movies/Beta (2021).md');
  });

  it('sends titles without an id to the unlinked inbox, including their seasons', () => {
    expect(plan.unlinked.map((t) => [t.mediaType, t.title]).sort()).toEqual(
      [
        ['movie', 'Alpha Again'],
        ['movie', 'Gamma'],
        ['series', 'Nameless'],
        ['season', 'Lost S1'],
        ['season', 'Nameless S1'],
        ['season', 'Zeta again'],
        ['videogame', 'Hollow Demo'],
        ['videogame', 'Nothing'],
        ['book', 'Book Two'],
      ].sort(),
    );
    expect(plan.unlinked.find((t) => t.title === 'Nothing')?.year).toBe(2010);
  });

  it('formats a report with counts and problems', () => {
    const text = formatReport(plan, false);
    expect(text).toContain('nothing was written');
    expect(text).toContain('movies:     2');
    expect(text).toContain('series:     3');
    expect(text).toContain('Unlinked inbox: 9');
    expect(text).toContain('orphan-season (2)');
    expect(text).toContain('Movies/Beta (2021).md [mood]');
  });
});

describe('ImportApplier', () => {
  let db: DatabaseSync;
  let store: ImageStore;
  let storeDir: string;
  let applier: ImportApplier;
  let repos: ConstructorParameters<typeof ImportApplier>[1];

  beforeEach(() => {
    db = openTestDatabase();
    storeDir = tempDir();
    store = new ImageStore(db, storeDir);
    repos = {
      movies: new MovieRepository(db),
      series: new SeriesRepository(db),
      seasons: new SeasonRepository(db),
      videogames: new VideogameRepository(db),
      books: new BookRepository(db),
      unlinked: new UnlinkedTitleRepository(db),
    };
    applier = new ImportApplier(db, repos, store, () => new Date('2026-10-24T10:00:00Z'));
  });

  it('writes every kind and is idempotent', async () => {
    const plan = planFor(writeVault(syntheticVault()));
    const first = await applier.apply(plan);
    expect(first.movies).toEqual({ created: 2, updated: 0, unchanged: 0 });
    expect(first.series.created).toBe(3);
    expect(first.seasons.created).toBe(4);
    expect(first.videogames.created).toBe(2);
    expect(first.books.created).toBe(1);
    expect(first.unlinked.created).toBe(9);

    const counts = (): number[] => [
      repos.movies.list().length,
      repos.series.list().length,
      repos.seasons.list().length,
      repos.videogames.list().length,
      repos.books.list().length,
      repos.unlinked.list().length,
    ];
    const before = counts();
    const again = await applier.apply(plan);
    expect(counts()).toEqual(before);
    for (const tally of [
      again.movies,
      again.series,
      again.seasons,
      again.videogames,
      again.books,
      again.unlinked,
    ]) {
      expect(tally.created).toBe(0);
      expect(tally.updated).toBe(0);
    }
    expect(repos.movies.findByTmdbId(100)).toMatchObject({
      finishedAt: '2024-03-05',
      status: 'completed',
    });
    expect(repos.videogames.findBySteamAppId('730')?.status).toBe('paused');
    expect(repos.books.findByOpenLibraryId('OL1W')).toMatchObject({
      authors: ['Someone'],
      pageCount: 320,
    });
  });

  it('imports local covers through the image store and skips remote ones without a copy', async () => {
    const plan = planFor(writeVault(syntheticVault()));
    const result = await applier.apply(plan);
    const beta = repos.movies.findByTmdbId(101)!;
    expect(beta.cover).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
    expect(store.list()).toHaveLength(1);
    expect(result.images.localStored).toBe(1);
    expect(result.images.remoteUnavailable).toBe(2);
    expect(repos.movies.findByTmdbId(100)).toMatchObject({ cover: null, banner: null });
  });

  it('links a remote URL only when a local copy already exists', async () => {
    const stored = await store.add(png(5, 7), REMOTE_COVER);
    const result = await applier.apply(planFor(writeVault(syntheticVault())));
    expect(repos.movies.findByTmdbId(100)?.cover).toBe(stored.ref);
    expect(result.images.remoteLinked).toBe(1);
  });

  it('keeps data added after the first import when a note leaves fields empty', async () => {
    const plan = planFor(writeVault(syntheticVault()));
    await applier.apply(plan);
    const alpha = repos.movies.findByTmdbId(100)!;
    repos.movies.update(alpha.id, { overview: 'Fetched later', startedAt: '2024-03-01' });
    await applier.apply(plan);
    expect(repos.movies.get(alpha.id)).toMatchObject({
      overview: 'Fetched later',
      startedAt: '2024-03-01',
    });
  });

  it('follows note changes to tracking fields, including clearing them', async () => {
    await applier.apply(planFor(writeVault(syntheticVault())));
    const files = syntheticVault();
    files['Movies/Alpha (2020).md'] =
      '---\ntitle: Alpha\ntype: movie\nstatus: Pausado\ntmdb_id: 100\nrating:\n---\n';
    const result = await applier.apply(planFor(writeVault(files)));
    expect(result.movies.updated).toBe(1);
    expect(repos.movies.findByTmdbId(100)).toMatchObject({
      status: 'paused',
      rating: null,
      finishedAt: null,
      review: null,
      rewatches: [],
    });
  });

  it('drops an unlinked row once its note gets an id', async () => {
    await applier.apply(planFor(writeVault(syntheticVault())));
    expect(repos.unlinked.findBySourceRef('obsidian-import', 'Juegos/Nothing.md')).toBeDefined();
    const files = syntheticVault();
    files['Juegos/Nothing.md'] = '---\ntitle: Nothing\ntype: videogame\nigdb_id: 999\n---\n';
    const result = await applier.apply(planFor(writeVault(files)));
    expect(result.unlinkedResolved).toBe(1);
    expect(repos.unlinked.findBySourceRef('obsidian-import', 'Juegos/Nothing.md')).toBeUndefined();
    expect(repos.videogames.findByIgdbId(999)?.title).toBe('Nothing');
  });

  it('rolls back every row when a write fails', async () => {
    const plan = planFor(writeVault(syntheticVault()));
    repos.series.create({ ...plan.series[0]!.entity, tmdbId: null, tvdbId: 900, title: 'Taken' });
    repos.series.create({ ...plan.series[0]!.entity, tmdbId: 200, tvdbId: null, title: 'Other' });
    await expect(applier.apply(plan)).rejects.toThrow();
    expect(repos.movies.list()).toHaveLength(0);
  });
});

describe('runImport', () => {
  it('reports without writing anything, not even the database', async () => {
    const vault = writeVault(syntheticVault());
    const dataDir = join(tempDir(), 'data');
    const output = await runImport({ vaultDir: vault, dataDir, apply: false, verbose: false });
    created.push(vault);
    expect(output).toContain('Import report');
    expect(existsSync(dataDir)).toBe(false);
  });

  it('applies to a temporary data directory and can be repeated', async () => {
    const vault = writeVault(syntheticVault());
    created.push(vault);
    const dataDir = join(tempDir(), 'data');
    const options = { vaultDir: vault, dataDir, apply: true, verbose: false };
    const first = await runImport(options);
    expect(first).toContain('Import report (applied)');
    expect(first).not.toContain('nothing was written');
    expect(first).toContain('movies:     created 2, updated 0, unchanged 0');
    expect(await runImport(options)).toContain('movies:     created 0, updated 0, unchanged 2');
    expect(existsSync(join(dataDir, 'metrack.db'))).toBe(true);
  });

  it('rejects a missing folder', async () => {
    await expect(
      runImport({
        vaultDir: '/nonexistent/vault',
        dataDir: tempDir(),
        apply: false,
        verbose: false,
      }),
    ).rejects.toThrow('Not a directory');
  });
});
