import { allEntries } from './allEntries.js';
import { coverSrc } from './imageOrDefault.js';
import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import { themeType } from './themeType.js';

export interface IndexItem {
  title: string;
  date: string | null;
  type: string;
  image: string;
  banner: string | null;
  status: string;
}

function newestFirst(a: PublicEntry, b: PublicEntry): number {
  if (a.finishedAt === b.finishedAt) return a.title.localeCompare(b.title, 'es');
  if (a.finishedAt === null) return 1;
  if (b.finishedAt === null) return -1;
  return b.finishedAt.localeCompare(a.finishedAt);
}

/** The library as the scripts of the collage and the hero banner read it: one item per shown entry, newest finish date first (undated last, ties by title) like the Hugo site, never one pending review. */
export function renderIndex(library: Library): string {
  const items: IndexItem[] = [...allEntries(library)].sort(newestFirst).map((entry) => ({
    title: entry.title,
    date: entry.finishedAt,
    type: themeType(entry.kind),
    image: coverSrc(entry.cover, library.handle, 'cover'),
    banner: imageSrc(entry.banner, library.handle, 'banner'),
    status: entry.status,
  }));
  return JSON.stringify(items);
}
