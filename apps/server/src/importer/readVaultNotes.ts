import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseFrontmatter } from './parseFrontmatter.js';
import { NOTE_KINDS, type NoteKind } from './NoteKind.js';
import type { IssueLog } from './IssueLog.js';
import type { VaultNote } from './VaultNote.js';

const SKIPPED_FOLDERS = new Set(['Portadas', 'Files']);

/**
 * Reads every note in the subfolders of the Media Tracker folder, ordered by path without extension, so a shorter name wins over its variants when ids clash. Files at the
 * top level are index notes and are ignored.
 */
export function readVaultNotes(vaultDir: string, issues: IssueLog): VaultNote[] {
  const notes: VaultNote[] = [];
  for (const file of listMarkdown(vaultDir, vaultDir)) {
    const path = relative(vaultDir, file).split(sep).join('/');
    const note = readNote(file, path, issues);
    if (note) notes.push(note);
  }
  return notes.sort(compareByPath);
}

function listMarkdown(root: string, dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === root && SKIPPED_FOLDERS.has(entry.name)) continue;
      files.push(...listMarkdown(root, full));
    } else if (dir !== root && entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function readNote(file: string, path: string, issues: IssueLog): VaultNote | null {
  let parsed;
  try {
    parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  } catch (error) {
    issues.add('parse-error', path, error instanceof Error ? error.message.split('\n')[0] : null);
    return null;
  }
  const kind = parsed.frontmatter.type;
  if (typeof kind !== 'string' || !(NOTE_KINDS as readonly string[]).includes(kind)) {
    issues.add('unknown-type', path, typeof kind === 'string' ? kind : null);
    return null;
  }
  const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
  return { path, name, kind: kind as NoteKind, ...parsed };
}

function compareByPath(a: VaultNote, b: VaultNote): number {
  const left = a.path.replace(/\.md$/, '');
  const right = b.path.replace(/\.md$/, '');
  return left < right ? -1 : left > right ? 1 : 0;
}
