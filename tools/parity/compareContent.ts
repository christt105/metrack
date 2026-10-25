import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * Compares the content tree the old migration script produced with the one `metrack export`
 * writes. Usage: tsx compareContent.ts <legacyContentDir> <exportedContentDir>
 */

const SECTIONS = ['movies', 'tv', 'seasons', 'games', 'books'];

const OBSIDIAN_ONLY: Record<string, string> = {
  category: 'Obsidian index link, not shown by the theme',
  related: 'Obsidian links, not shown by the theme',
  cssclasses: 'Obsidian styling',
  banner_position: 'Obsidian banner plugin',
  banner: 'Obsidian banner plugin value left over when the image could not be fetched',
  aliases: 'Obsidian aliases',
};

interface Page {
  fields: Record<string, unknown>;
  body: string;
  dir: string;
}

function readPage(dir: string): Page | null {
  const file = join(dir, 'index.md');
  if (!existsSync(file)) return null;
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(readFileSync(file, 'utf8'));
  if (!match) throw new Error(`No front matter in ${file}`);
  const fields = (parse(match[1] ?? '', { version: '1.1' }) ?? {}) as Record<string, unknown>;
  return { fields, body: (match[2] ?? '').trim(), dir };
}

function readTree(root: string): Map<string, Page> {
  const pages = new Map<string, Page>();
  for (const section of SECTIONS) {
    const sectionDir = join(root, section);
    if (!existsSync(sectionDir)) continue;
    for (const slug of readdirSync(sectionDir)) {
      const page = readPage(join(sectionDir, slug));
      if (page) pages.set(`${section}/${slug}`, page);
    }
  }
  return pages;
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value)) return value.length === 0 ? undefined : value.map(normalize);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return String(value);
  return value;
}

function sha(path: string): string | null {
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
}

type Tally = Map<string, string[]>;
const add = (tally: Tally, key: string, example: string): void => {
  tally.set(key, [...(tally.get(key) ?? []), example]);
};

function report(title: string, tally: Tally): void {
  console.log(`\n${title}`);
  if (tally.size === 0) console.log('  none');
  for (const [key, examples] of [...tally].sort()) {
    console.log(`  ${key}: ${examples.length} (e.g. ${examples.slice(0, 3).join('; ')})`);
  }
}

function main(legacyRoot: string, exportedRoot: string): void {
  const legacy = readTree(legacyRoot);
  const exported = readTree(exportedRoot);
  console.log(`legacy pages: ${legacy.size}, exported pages: ${exported.size}`);

  const missing: Tally = new Map();
  const extra: Tally = new Map();
  for (const key of legacy.keys()) if (!exported.has(key)) add(missing, key.split('/')[0]!, key);
  for (const key of exported.keys()) if (!legacy.has(key)) add(extra, key.split('/')[0]!, key);

  const fieldDiffs: Tally = new Map();
  const droppedFields: Tally = new Map();
  const bodyDiffs: Tally = new Map();
  const imageDiffs: Tally = new Map();
  let identical = 0;

  for (const [key, old] of legacy) {
    const fresh = exported.get(key);
    if (!fresh) continue;
    let same = true;
    const names = new Set([...Object.keys(old.fields), ...Object.keys(fresh.fields)]);
    for (const name of names) {
      if (name === 'image' || name === 'banner_image') continue;
      const before = normalize(old.fields[name]);
      const after = normalize(fresh.fields[name]);
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      if (name in OBSIDIAN_ONLY && after === undefined) {
        add(droppedFields, `${name} (${OBSIDIAN_ONLY[name]})`, key);
        continue;
      }
      same = false;
      add(
        fieldDiffs,
        `${key.split('/')[0]}.${name}`,
        `${key}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
      );
    }
    const bodyImages = (page: Page): string[] =>
      [...page.body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)]
        .map((m) => sha(join(page.dir, m[1] ?? '')) ?? `missing:${m[1]}`)
        .sort();
    const stripImages = (page: Page): string =>
      page.body.replace(/(!\[[^\]|]*)(?:\|\d+)?\]\([^)\s]+\)/g, '$1]()');
    if (stripImages(old) !== stripImages(fresh)) {
      same = false;
      add(bodyDiffs, `${key.split('/')[0]} text`, key);
    }
    if (JSON.stringify(bodyImages(old)) !== JSON.stringify(bodyImages(fresh))) {
      same = false;
      add(bodyDiffs, `${key.split('/')[0]} embedded image bytes`, key);
    }
    for (const name of ['image', 'banner_image']) {
      const before = typeof old.fields[name] === 'string' ? old.fields[name] : null;
      const after = typeof fresh.fields[name] === 'string' ? fresh.fields[name] : null;
      if (before === null && after === null) continue;
      if (before === null || after === null) {
        same = false;
        add(imageDiffs, `${name} ${before === null ? 'only in export' : 'missing in export'}`, key);
      } else if (sha(join(old.dir, before)) !== sha(join(fresh.dir, after))) {
        same = false;
        add(imageDiffs, `${name} bytes differ`, key);
      } else if (before !== after) {
        add(imageDiffs, `${name} renamed (same bytes)`, key);
      }
    }
    if (same) identical += 1;
  }

  report('Pages missing from the export', missing);
  report('Pages only in the export', extra);
  report(
    'Front matter fields that differ (after normalizing null, empty, numbers and dates)',
    fieldDiffs,
  );
  report('Obsidian-only fields not exported', droppedFields);
  report('Bodies that differ', bodyDiffs);
  report('Image differences', imageDiffs);
  console.log(
    `\nPages with no difference beyond the listed Obsidian-only fields: ${identical} of ${legacy.size}`,
  );
}

const [legacyRoot, exportedRoot] = process.argv.slice(2);
if (!legacyRoot || !exportedRoot) {
  console.error('Usage: tsx compareContent.ts <legacyContentDir> <exportedContentDir>');
  process.exit(2);
}
main(legacyRoot, exportedRoot);
