import { escapeHtml } from '@metrack/export';
import { allEntries } from './allEntries.js';
import { entryStatus } from './entryStatus.js';
import { finishedViewings } from './finishedViewings.js';
import { homeEntries } from './homeEntries.js';
import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import { ownerName } from './ownerName.js';
import { renderBio } from './renderBio.js';
import { renderCard } from './renderCard.js';
import { renderFilterBar } from './renderFilterBar.js';
import { renderLayout } from './renderLayout.js';
import { renderYearNav } from './renderYearNav.js';
import { themeType, type ThemeType } from './themeType.js';
import { yearOf } from './yearOf.js';

const byTitle =
  (collation: string) =>
  (a: PublicEntry, b: PublicEntry): number =>
    a.title.localeCompare(b.title, collation);

const byRecent =
  (collation: string) =>
  (a: PublicEntry, b: PublicEntry): number =>
    (b.startedAt ?? '').localeCompare(a.startedAt ?? '') || byTitle(collation)(a, b);

const count = (value: number): string => ` <span class="count">${value}</span>`;

function grid(library: Library, entries: PublicEntry[]): string {
  return `<div class="grid">${entries.map((entry) => renderCard(library, entry, null)).join('')}</div>`;
}

function inProgress(library: Library, entries: PublicEntry[]): string {
  const current = entries.filter((entry) => entryStatus(entry) === 'in_progress');
  if (current.length === 0) return '';
  return `<section class="group"><h2 class="section-title">${library.messages.statusLabels['in_progress']}${count(current.length)}</h2>${grid(library, [...current].sort(byRecent(library.messages.collation)))}</section>`;
}

function completed(library: Library, entries: PublicEntry[], hasCurrent: boolean): string {
  const viewings = finishedViewings(entries, library.messages.collation);
  if (viewings.length === 0) {
    return hasCurrent ? '' : `<p class="empty">${library.messages.home.noneCompleted}</p>`;
  }
  const years = new Map<string, typeof viewings>();
  for (const viewing of viewings) {
    const year = yearOf(viewing.date) ?? '';
    years.set(year, [...(years.get(year) ?? []), viewing]);
  }
  const groups = [...years].map(([year, group]) => {
    const id = year === '' ? 'unknown' : year;
    const title = year === '' ? library.messages.home.unknownYear : year;
    const cards = group.map((viewing) => renderCard(library, viewing.entry, viewing.date)).join('');
    return `<section class="group year-group"><h3 class="year-title" id="year-${id}">${escapeHtml(title)}${count(group.length)}</h3><div class="grid">${cards}</div></section>`;
  });
  return `<section class="completed" id="completed"><h2 class="section-title">${library.messages.home.completed}</h2>${renderYearNav(viewings)}${groups.join('')}</section>`;
}

function setAside(library: Library, entries: PublicEntry[]): string {
  const recent = byRecent(library.messages.collation);
  const paused = entries.filter((entry) => entryStatus(entry) === 'paused').sort(recent);
  const dropped = entries.filter((entry) => entryStatus(entry) === 'dropped').sort(recent);
  if (paused.length + dropped.length === 0) return '';
  const part = (title: string, group: PublicEntry[]): string =>
    group.length === 0
      ? ''
      : `<section class="group"><h3 class="year-title">${title}${count(group.length)}</h3>${grid(library, group)}</section>`;
  return `<details class="set-aside" id="set-aside"><summary>${library.messages.home.setAside(paused.length + dropped.length)}</summary>${part(library.messages.statusLabels['paused'] as string, paused)}${part(library.messages.statusLabels['dropped'] as string, dropped)}</details>`;
}

function banners(library: Library): string[] {
  return allEntries(library).flatMap((entry) => {
    if (entry.kind === 'season') return [];
    const src = imageSrc(entry.banner, library.handle, 'banner');
    return src === null ? [] : [src];
  });
}

/** The library home: the profile, the search and filters, what is in progress, what is finished by year and, folded away, what is paused or dropped. */
export function renderHome(library: Library): string {
  const entries = homeEntries(library);
  const everything = allEntries(library);
  const current = inProgress(library, entries);
  const shownTypes = [...new Set(everything.map((entry) => themeType(entry.kind)))] as ThemeType[];
  const body =
    everything.length === 0
      ? `<p class="empty">${library.messages.home.emptyLibrary}</p>`
      : `${renderFilterBar(everything, shownTypes, library.messages)}${current}${completed(library, entries, current !== '')}${setAside(library, entries)}`;
  return renderLayout({
    library,
    title: ownerName(library),
    active: 'home',
    page: `${renderBio(library)}<main class="wrap home" aria-label="${library.messages.contentLabel}">${body}</main>`,
    data: { banners: banners(library) },
  });
}
