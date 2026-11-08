import { allEntries } from './allEntries.js';
import { coverSrc } from './imageOrDefault.js';
import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import { themeType } from './themeType.js';

export interface IndexItem {
  title: string;
  date: string | null;
  type: string;
  image: string;
  banner: string | null;
  status: string;
}

/** The library as the scripts of the collage and the hero banner read it: one item per shown entry, never one pending review. */
export function renderIndex(library: Library): string {
  const items: IndexItem[] = allEntries(library).map((entry) => ({
    title: entry.title,
    date: entry.finishedAt,
    type: themeType(entry.kind),
    image: coverSrc(entry.cover, library.handle, 'cover'),
    banner: imageSrc(entry.banner, library.handle, 'banner'),
    status: entry.status,
  }));
  return JSON.stringify(items);
}
