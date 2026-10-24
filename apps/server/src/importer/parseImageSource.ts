import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { readText } from './fieldReaders.js';
import type { ImageSource } from './ImageSource.js';
import type { IssueLog } from './IssueLog.js';

const WIKILINK = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;

/**
 * Interprets a `cover` or `banner` value. Web URLs stay remote; wikilinks and relative paths are
 * looked up in the vault and dropped (with an issue) when no file exists.
 */
export function parseImageSource(
  value: unknown,
  field: string,
  vaultDir: string,
  notePath: string,
  issues: IssueLog,
): ImageSource | null {
  const raw = readText(value);
  if (raw === null) return null;
  if (/^https?:\/\//i.test(raw)) return { kind: 'remote', url: raw };

  const target = WIKILINK.exec(raw)?.[1]?.trim() ?? raw;
  const found = localCandidates(vaultDir, target).find(isFile);
  if (found) return { kind: 'local', path: found };
  issues.add('missing-image', notePath, `${field}: ${raw}`);
  return null;
}

function localCandidates(vaultDir: string, target: string): string[] {
  const name = basename(target);
  return [
    join(dirname(vaultDir), target),
    join(vaultDir, target),
    join(vaultDir, 'Portadas', name),
    join(vaultDir, 'Files', name),
  ];
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}
