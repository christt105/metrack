import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { buildVaultMirror, MIRROR_FOLDERS } from '@metrack/export';
import type { ExistingNote } from '@metrack/export';
import type { ExportSources } from '../export/loadExportInput.js';
import { loadExportInput } from '../export/loadExportInput.js';
import { parseFrontmatter } from '../importer/parseFrontmatter.js';
import { MirrorImageResolver } from './MirrorImageResolver.js';
import type { MirrorState } from './MirrorState.js';
import { readMirrorState } from './readMirrorState.js';
import { VaultImageIndex } from './VaultImageIndex.js';
import type { VaultMirrorOptions } from './VaultMirrorOptions.js';
import type { VaultMirrorResult } from './VaultMirrorResult.js';
import { writeFileAtomic } from './writeFileAtomic.js';

const IMAGE_FOLDERS = { covers: 'Portadas', files: 'Files' };

function inside(mirrorDir: string, path: string): string {
  const target = resolve(mirrorDir, path);
  const rel = relative(mirrorDir, target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing to write ${path}: outside the mirror folder`);
  }
  return target;
}

interface OnDisk {
  raw: Map<string, string>;
  parsed: Map<string, ExistingNote>;
  skipped: VaultMirrorResult['skipped'];
}

function readNotes(mirrorDir: string): OnDisk {
  const onDisk: OnDisk = { raw: new Map(), parsed: new Map(), skipped: [] };
  for (const folder of Object.values(MIRROR_FOLDERS)) {
    const dir = join(mirrorDir, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith('.md')) continue;
      const path = `${folder}/${name}`;
      const raw = readFileSync(join(dir, name), 'utf8');
      onDisk.raw.set(path, raw);
      try {
        onDisk.parsed.set(path, parseFrontmatter(raw));
      } catch (error) {
        onDisk.skipped.push({
          path,
          reason: error instanceof Error ? error.message.split('\n')[0]! : String(error),
        });
      }
    }
  }
  return onDisk;
}

/**
 * Brings the read-only notes in the vault in line with the database. Only notes whose text changes
 * are written; notes it wrote before and that no longer match an item are removed; any other note
 * in the folders is left alone.
 */
export function syncVaultMirror(
  sources: ExportSources,
  options: VaultMirrorOptions,
): VaultMirrorResult {
  const mirrorDir = resolve(options.mirrorDir);
  const onDisk = readNotes(mirrorDir);
  const index = new VaultImageIndex(mirrorDir, options.linkPrefix, Object.values(IMAGE_FOLDERS));
  const images = new MirrorImageResolver(sources.images, index, options.linkPrefix, IMAGE_FOLDERS);
  const notes = buildVaultMirror(loadExportInput(sources), {
    existing: onDisk.parsed,
    images,
    webUrl: options.webUrl,
  });

  const result: VaultMirrorResult = {
    created: [],
    updated: [],
    unchanged: 0,
    removed: [],
    copiedImages: [],
    skipped: onDisk.skipped,
    unmanaged: [],
  };
  const unreadable = new Set(onDisk.skipped.map((entry) => entry.path));

  for (const copy of images.pendingCopies()) {
    const image = sources.images.get(copy.hash);
    const target = inside(mirrorDir, copy.path);
    if (image === undefined || existsSync(target)) continue;
    result.copiedImages.push(copy.path);
    if (options.apply) writeFileAtomic(target, sources.images.read(image));
  }

  const produced = new Set<string>();
  for (const note of notes) {
    produced.add(note.path);
    if (unreadable.has(note.path)) continue;
    const current = onDisk.raw.get(note.path);
    if (current === note.content) {
      result.unchanged += 1;
      continue;
    }
    (current === undefined ? result.created : result.updated).push(note.path);
    if (options.apply) writeFileAtomic(inside(mirrorDir, note.path), note.content);
  }

  const previous = new Set(readMirrorState(options.statePath, mirrorDir));
  for (const path of onDisk.raw.keys()) {
    if (produced.has(path)) continue;
    if (!previous.has(path)) {
      result.unmanaged.push(path);
      continue;
    }
    result.removed.push(path);
    if (options.apply) rmSync(inside(mirrorDir, path));
  }

  if (options.apply) {
    const state: MirrorState = { mirrorDir, notes: [...produced].sort() };
    writeFileAtomic(options.statePath, `${JSON.stringify(state, null, 2)}\n`);
  }
  return result;
}
