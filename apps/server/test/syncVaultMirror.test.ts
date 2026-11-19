import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openExportSources } from '../src/export/openExportSources.js';
import { syncVaultMirror } from '../src/mirror/syncVaultMirror.js';
import { png } from './support/sampleImages.js';
import { seedMirrorLibrary } from './support/seedMirrorLibrary.js';
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

async function seededVault() {
  const vault = writeVault(syntheticVault());
  created.push(vault);
  const dataDir = tempDir();
  const { db, sources } = openExportSources(dataDir);
  try {
    await seedMirrorLibrary(sources);
  } finally {
    db.close();
  }
  return { vault, dataDir };
}

async function mirror(vault: string, dataDir: string, apply: boolean) {
  const { db, sources } = openExportSources(dataDir);
  try {
    return await syncVaultMirror(sources, {
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
    const { vault, dataDir } = await seededVault();
    const before = readFileSync(join(vault, 'Movies/Alpha (2020).md'), 'utf8');

    const report = await mirror(vault, dataDir, false);
    expect(report.updated).toContain('Movies/Alpha (2020).md');
    expect(readFileSync(join(vault, 'Movies/Alpha (2020).md'), 'utf8')).toBe(before);
    expect(existsSync(join(dataDir, 'vault-mirror-state.json'))).toBe(false);

    await mirror(vault, dataDir, true);
    const alpha = readFileSync(join(vault, 'Movies/Alpha (2020).md'), 'utf8');
    expect(alpha).toContain('metrack: http://metrack.lan/movies/');
    expect(alpha.endsWith('---\nGreat film.\n')).toBe(true);

    const again = await mirror(vault, dataDir, true);
    expect(again.created).toEqual([]);
    expect(again.updated).toEqual([]);
    expect(again.removed).toEqual([]);
  });

  it('keeps properties it does not own and leaves notes of no item alone', async () => {
    const { vault, dataDir } = await seededVault();
    const result = await mirror(vault, dataDir, true);
    expect(readFileSync(join(vault, 'Movies/Beta (2021).md'), 'utf8')).toContain('mood: happy');
    expect(result.unmanaged).toContain('Movies/Alpha Again.md');
    expect(existsSync(join(vault, 'Movies/Alpha Again.md'))).toBe(true);
  });

  it('links local covers to the vault file with the same bytes', async () => {
    const { vault, dataDir } = await seededVault();
    await mirror(vault, dataDir, true);
    expect(readFileSync(join(vault, 'Movies/Beta (2021).md'), 'utf8')).toContain(
      'cover: "[[Media Tracker/Portadas/Local Cover.png]]"',
    );
  });

  it('copies images the vault does not have and removes notes it wrote for deleted items', async () => {
    const { vault, dataDir } = await seededVault();
    await mirror(vault, dataDir, true);
    const { db, sources } = openExportSources(dataDir);
    try {
      const image = await sources.images.add(png(10, 15, 7), null);
      const beta = (await sources.movies.list()).find((movie) => movie.title === 'Beta')!;
      await sources.movies.update(beta.id, { cover: image.ref });
      const alpha = (await sources.movies.list()).find((movie) => movie.title === 'Alpha')!;
      await sources.movies.delete(alpha.id);
    } finally {
      db.close();
    }
    writeFileSync(join(vault, 'Movies/Hand written.md'), '# mine\n');

    const result = await mirror(vault, dataDir, true);
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

  it('writes a linked cover as its provider URL unless the note already has the same image', async () => {
    const { vault, dataDir } = await seededVault();
    await mirror(vault, dataDir, true);
    const alphaUrl = 'https://image.tmdb.org/t/p/original/alpha.jpg';
    const betaUrl = 'https://image.tmdb.org/t/p/original/beta.jpg';
    const { db, sources } = openExportSources(dataDir);
    try {
      const movies = await sources.movies.list();
      const alpha = movies.find((movie) => movie.title === 'Alpha')!;
      const beta = movies.find((movie) => movie.title === 'Beta')!;
      const local = await sources.images.get(String(beta.cover).slice('/api/images/'.length));
      await sources.images.add(await sources.images.read(local!), betaUrl);
      await sources.movies.update(alpha.id, { cover: alphaUrl });
      await sources.movies.update(beta.id, { cover: betaUrl });
    } finally {
      db.close();
    }
    await mirror(vault, dataDir, true);
    expect(readFileSync(join(vault, 'Movies/Alpha (2020).md'), 'utf8')).toContain(
      `cover: ${alphaUrl}`,
    );
    expect(readFileSync(join(vault, 'Movies/Beta (2021).md'), 'utf8')).toContain(
      'cover: "[[Media Tracker/Portadas/Local Cover.png]]"',
    );
    const again = await mirror(vault, dataDir, true);
    expect(again.updated).toEqual([]);
    expect(again.copiedImages).toEqual([]);
  });
});
