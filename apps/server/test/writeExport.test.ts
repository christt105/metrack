import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeExport } from '../src/export/writeExport.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function siteDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'metrack-write-'));
  dirs.push(root);
  const site = join(root, 'site');
  mkdirSync(join(site, 'content', 'movies', 'Old'), { recursive: true });
  writeFileSync(join(site, 'content', 'movies', 'Old', 'index.md'), 'old');
  return site;
}

const noImages = (hash: string): string => {
  throw new Error(`unexpected image ${hash}`);
};

describe('writeExport', () => {
  it('replaces the owned sections with the exported files', () => {
    const site = siteDir();
    writeExport(
      [{ kind: 'text', path: 'content/movies/New/index.md', content: 'new' }],
      site,
      noImages,
    );
    expect(existsSync(join(site, 'content', 'movies', 'Old'))).toBe(false);
    expect(readFileSync(join(site, 'content', 'movies', 'New', 'index.md'), 'utf8')).toBe('new');
  });

  it.each(['content/movies/../../../escape/index.md', '../escape.md', '/tmp/escape.md', '.'])(
    'refuses %j without touching the disk',
    (path) => {
      const site = siteDir();
      expect(() =>
        writeExport(
          [
            { kind: 'text', path: 'content/movies/New/index.md', content: 'new' },
            { kind: 'text', path, content: 'evil' },
          ],
          site,
          noImages,
        ),
      ).toThrow(/outside the export directory/);
      expect(existsSync(join(site, 'content', 'movies', 'Old', 'index.md'))).toBe(true);
      expect(existsSync(join(site, 'content', 'movies', 'New'))).toBe(false);
      expect(existsSync(join(site, '..', 'escape'))).toBe(false);
      expect(existsSync(join(site, '..', 'escape.md'))).toBe(false);
    },
  );

  it('refuses an image that would escape', () => {
    const site = siteDir();
    expect(() =>
      writeExport([{ kind: 'image', path: 'content/../../img.png', hash: 'h' }], site, noImages),
    ).toThrow(/outside the export directory/);
  });
});
