import { escapeHtml } from '@metrack/export';
import { allEntries } from './allEntries.js';
import { finishedViewings } from './finishedViewings.js';
import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import { ratingTheme } from './ratingTheme.js';
import { reviewHtml } from './reviewHtml.js';
import { entryPath, feedPath, homePath } from './sitePaths.js';

export const FEED_LIMIT = 100;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rfc822(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${DAYS[day.getUTCDay()]}, ${pad(day.getUTCDate())} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()} 00:00:00 +0000`;
}

function xml(text: string): string {
  const printable = [...text].filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 || code === 9 || code === 10 || code === 13;
  });
  return escapeHtml(printable.join(''));
}

function item(library: Library, entry: PublicEntry, date: string, origin: string): string {
  const link = `${origin}${entryPath(library.handle, entry.kind, entry.id)}`;
  const cover = imageSrc(entry.cover, library.handle, 'thumb', origin);
  const lead =
    entry.rating === null
      ? ''
      : `<p>Nota: ${entry.rating} (${escapeHtml(ratingTheme(entry.rating).label)})</p>`;
  const description = `${lead}${reviewHtml(library, entry, origin)}`;
  return `<item>
<title>${xml(entry.title)}</title>
<link>${xml(link)}</link>
<guid isPermaLink="false">${xml(`metrack:${library.handle}:${entry.kind}:${entry.id}:${date}`)}</guid>
<pubDate>${rfc822(date)}</pubDate>
<description>${xml(description)}</description>
<category domain="status">finished</category>
<category domain="type">${entry.kind}</category>${cover === null ? '' : `\n<media:thumbnail url="${xml(cover)}"/>`}
</item>`;
}

/**
 * An RSS 2.0 feed of the finished viewings, newest first: the finish date of each item and every
 * rewatch are separate entries. A viewing's guid is made of the item's address in the library and
 * its date, so it stays the same however the site is reached.
 */
export function renderFeed(library: Library, origin: string): string {
  const viewings = finishedViewings(allEntries(library))
    .filter((viewing) => viewing.date !== null)
    .slice(0, FEED_LIMIT);
  const home = `${origin}${homePath(library.handle)}`;
  const items = viewings.map((viewing) =>
    item(library, viewing.entry, viewing.date as string, origin),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>Acabados · @${xml(library.handle)}</title>
<link>${xml(home)}</link>
<description>Elementos acabados por @${xml(library.handle)}</description>
<language>es</language>
<atom:link href="${xml(`${origin}${feedPath(library.handle)}`)}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel>
</rss>
`;
}
