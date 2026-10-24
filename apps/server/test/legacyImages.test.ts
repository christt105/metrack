import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatReport } from '../src/importer/formatReport.js';
import { buildImportPlan } from '../src/importer/buildImportPlan.js';
import { ImageStore } from '../src/images/ImageStore.js';
import { ImportApplier } from '../src/importer/ImportApplier.js';
import { IssueLog } from '../src/importer/IssueLog.js';
import { legacyImageName } from '../src/importer/legacyImageName.js';
import { LegacyImageIndex } from '../src/importer/LegacyImageIndex.js';
import { readVaultNotes } from '../src/importer/readVaultNotes.js';
import { runImport } from '../src/importer/runImport.js';
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
import { syntheticVault, REMOTE_COVER, UNKNOWN_REMOTE_COVER } from './support/syntheticVault.js';
import { writeVault } from './support/writeVault.js';

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function writeFiles(files: Record<string, Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-legacy-'));
  created.push(dir);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

describe('legacyImageName', () => {
  it('uses the provider image id for known providers', () => {
    expect(legacyImageName('https://image.tmdb.org/t/p/original/abc123.jpg')).toBe(
      'tmdb_abc123.jpg',
    );
    expect(legacyImageName('https://artworks.thetvdb.com/banners/posters/55-1.jpg')).toBe(
      'tvdb_55-1.jpg',
    );
    expect(legacyImageName('https://cdn2.steamgriddb.com/grid/zzz.webp')).toBe(
      'steamgriddb_zzz.webp',
    );
    expect(
      legacyImageName(
        'https://cdn.cloudflare.steamstatic.com/steam/apps/751780/library_hero.jpg?t=5',
      ),
    ).toBe('steam_751780_library_hero.jpg');
  });

  it('hashes any other value with MD5 and keeps a short extension', () => {
    expect(legacyImageName('https://cdn.example.test/img/cover.png?x=1')).toBe(
      'img_c1093c1ad0c147864c288c0900639da2.png',
    );
    expect(
      legacyImageName('https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg'),
    ).toBe('img_dd0592c2d5ee11eaac83efbee2837575.jpg');
  });
});

describe('LegacyImageIndex', () => {
  it('finds files by their legacy name across directories and subfolders', () => {
    const a = writeFiles({ 'cache/tmdb_known.jpg': png(2, 3) });
    const b = writeFiles({ 'nested/deeper/steamgriddb_x.png': png(2, 3) });
    const index = new LegacyImageIndex([a, b]);
    expect(index.find('https://image.tmdb.org/t/p/original/known.jpg')).toBe(
      join(a, 'cache/tmdb_known.jpg'),
    );
    expect(index.find('https://cdn2.steamgriddb.com/grid/x.png')).toBe(
      join(b, 'nested/deeper/steamgriddb_x.png'),
    );
    expect(index.find('https://image.tmdb.org/t/p/original/missing.jpg')).toBeNull();
  });
});

describe('importing images from legacy directories', () => {
  const imagesDir = (): string =>
    writeFiles({
      'images_cache/img_11e67cfe40ff3b824153949307797e84.jpg': png(10, 20),
    });

  it('reports how many remote URLs would resolve and lists the rest', () => {
    const vault = writeVault(syntheticVault());
    created.push(vault);
    const issues = new IssueLog();
    const plan = buildImportPlan(readVaultNotes(vault, issues), vault, issues);
    const index = new LegacyImageIndex([imagesDir()]);
    const report = formatReport(plan, false, index);
    expect(report).toContain('remote URLs: 2 (1 found in the images directories, 1 without');
    expect(report).toContain(UNKNOWN_REMOTE_COVER);
  });

  it('imports matching files, records their URL and is idempotent', async () => {
    const vault = writeVault(syntheticVault());
    const dataDir = mkdtempSync(join(tmpdir(), 'metrack-data-'));
    created.push(vault, dataDir);
    const dirs = [imagesDir()];

    const first = await runImport({
      vaultDir: vault,
      dataDir,
      apply: true,
      imagesDirs: dirs,
      verbose: false,
    });
    expect(first).toContain('remote URLs imported from images directories: 1');
    expect(first).toContain('remote URLs without a local copy (left empty): 1');
    const second = await runImport({
      vaultDir: vault,
      dataDir,
      apply: true,
      imagesDirs: dirs,
      verbose: false,
    });
    expect(second).toContain('remote URLs linked to an existing local copy: 1');
    expect(second).toContain('remote URLs imported from images directories: 0');
  });

  it('stores the image under the URL so later lookups hit the store', async () => {
    const db = openTestDatabase();
    const dir = mkdtempSync(join(tmpdir(), 'metrack-images-'));
    created.push(dir);
    const store = new ImageStore(db, dir);
    const targets = {
      movies: new MovieRepository(db),
      series: new SeriesRepository(db),
      seasons: new SeasonRepository(db),
      videogames: new VideogameRepository(db),
      books: new BookRepository(db),
      unlinked: new UnlinkedTitleRepository(db),
    };
    const vault = writeVault(syntheticVault());
    created.push(vault);
    const issues = new IssueLog();
    const plan = buildImportPlan(readVaultNotes(vault, issues), vault, issues);
    const applier = new ImportApplier(
      db,
      targets,
      store,
      undefined,
      new LegacyImageIndex([imagesDir()]),
    );
    const result = await applier.apply(plan);
    expect(result.images.remoteImported).toBe(1);
    const stored = store.findBySourceUrl(REMOTE_COVER);
    expect(stored).toBeDefined();
    expect(targets.movies.findByTmdbId(100)?.cover).toBe(stored?.ref);
  });

  it('rejects an images directory that does not exist', async () => {
    const vault = writeVault(syntheticVault());
    created.push(vault);
    await expect(
      runImport({
        vaultDir: vault,
        dataDir: vault,
        apply: false,
        verbose: false,
        imagesDirs: [join(vault, 'nope')],
      }),
    ).rejects.toThrow('Not a directory');
  });
});
