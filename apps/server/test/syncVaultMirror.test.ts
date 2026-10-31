import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openExportSources } from '../src/export/openExportSources.js';
import { runImport } from '../src/importer/runImport.js';
import { syncVaultMirror } from '../src/mirror/syncVaultMirror.js';
import { png } from './support/sampleImages.js';
import { syntheticVault } from './support/syntheticVault.js';
import { writeVault } from './support/writeVault.js';

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'metrack-mirror-'));
  created.push(dir);
  return dir;
}

async function importedVault() {
  const vault = writeVault(syntheticVault());
  created.push(vault);
  const dataDir = tempDir();
  await runImport({ vaultDir: vault, dataDir, apply: true, verbose: false });
  return { vault, dataDir };
}

function mirror(vault: string, dataDir: string, apply: boolean) {
  const { db, sources } = openExportSources(dataDir);
  try {
    return syncVaultMirror(sources, {
      mirrorDir: vault,
      linkPrefix: 'Media Tracker',
      webUrl: 'http://metrack.lan',
      statePath: join(dataDir, 'vault-mirror-state.json'),
      apply,
    });
  } finally {
    db.close();
  }
}

describe('syncVaultMirror', () => {
  it('reports without writing, then writes and is idempotent', async () => {
    const { vault, dataDir } = await importedVault();
    const before = readFileSync(join(vault, 'Movies/Alpha (2020).md'), 'utf8');

    const report = mirror(vault, dataDir, false);
    expect(report.updated).toContain('Movies/Alpha (2020).md');
    expect(readFileSync(join(vault, 'Movies/Alpha (2020).md'), 'utf8')).toBe(before);
    expect(existsSync(join(dataDir, 'vault-mirror-state.json'))).toBe(false);

    mirror(vault, dataDir, true);
    const alpha = readFileSync(join(vault, 'Movies/Alpha (2020).md'), 'utf8');
    expect(alpha).toContain('metrack: http://metrack.lan/movies/');
    expect(alpha.endsWith('---\nGreat film.\n')).toBe(true);

    const again = mirror(vault, dataDir, true);
    expect(again.created).toEqual([]);
    expect(again.updated).toEqual([]);
    expect(again.removed).toEqual([]);
  });

  it('keeps properties it does not own and leaves notes of no item alone', async () => {
    const { vault, dataDir } = await importedVault();
    const result = mirror(vault, dataDir, true);
    expect(readFileSync(join(vault, 'Movies/Beta (2021).md'), 'utf8')).toContain('mood: happy');
    expect(result.unmanaged).toContain('Movies/Alpha Again.md');
    expect(existsSync(join(vault, 'Movies/Alpha Again.md'))).toBe(true);
  });

  it('links local covers to the vault file with the same bytes', async () => {
    const { vault, dataDir } = await importedVault();
    mirror(vault, dataDir, true);
    expect(readFileSync(join(vault, 'Movies/Beta (2021).md'), 'utf8')).toContain(
      'cover: "[[Media Tracker/Portadas/Local Cover.png]]"',
    );
  });

  it('copies images the vault does not have and removes notes it wrote for deleted items', async () => {
    const { vault, dataDir } = await importedVault();
    mirror(vault, dataDir, true);
    const { db, sources } = openExportSources(dataDir);
    try {
      const image = await sources.images.add(png(10, 15, 7), null);
      const beta = sources.movies.list().find((movie) => movie.title === 'Beta')!;
      sources.movies.update(beta.id, { cover: image.ref });
      const alpha = sources.movies.list().find((movie) => movie.title === 'Alpha')!;
      sources.movies.delete(alpha.id);
    } finally {
      db.close();
    }
    writeFileSync(join(vault, 'Movies/Hand written.md'), '# mine\n');

    const result = mirror(vault, dataDir, true);
    expect(result.removed).toEqual(['Movies/Alpha (2020).md']);
    expect(existsSync(join(vault, 'Movies/Alpha (2020).md'))).toBe(false);
    expect(existsSync(join(vault, 'Movies/Hand written.md'))).toBe(true);
    expect(result.copiedImages).toHaveLength(1);
    const copy = result.copiedImages[0]!;
    expect(copy).toMatch(/^Portadas\/metrack-[0-9a-f]{16}\.png$/);
    expect(existsSync(join(vault, copy))).toBe(true);
    expect(readFileSync(join(vault, 'Movies/Beta (2021).md'), 'utf8')).toContain(
      `cover: "[[Media Tracker/${copy}]]"`,
    );
  });

  it('reads back through the importer as the same library', async () => {
    const { vault, dataDir } = await importedVault();
    mirror(vault, dataDir, true);
    const secondData = tempDir();
    await runImport({ vaultDir: vault, dataDir: secondData, apply: true, verbose: false });

    const snapshot = (dir: string) => {
      const { db, sources } = openExportSources(dir);
      try {
        const strip = <T extends { id: number }>(rows: T[]) =>
          rows
            .map((row) => JSON.stringify({ ...row, id: undefined }))
            .sort()
            .map((row): unknown => JSON.parse(row));
        const seriesTitle = new Map(sources.series.list().map((s) => [s.id, s.title]));
        return {
          seasons: strip(
            sources.seasons
              .list()
              .map(({ seriesId, ...rest }) => ({ ...rest, series: seriesTitle.get(seriesId) })),
          ),
          movies: strip(sources.movies.list()),
          series: strip(sources.series.list()),
          videogames: strip(sources.videogames.list()),
          books: strip(sources.books.list()),
        };
      } finally {
        db.close();
      }
    };
    const original = snapshot(dataDir);
    expect(original.movies.length).toBeGreaterThan(0);
    expect(original.seasons.length).toBeGreaterThan(1);
    expect(snapshot(secondData)).toEqual(original);
  });
});
