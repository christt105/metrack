import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { finishedViewings } from './finishedViewings.js';
import { homeEntries } from './homeEntries.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import { ownerName } from './ownerName.js';
import { renderBio } from './renderBio.js';
import { renderCard } from './renderCard.js';
import { renderFilterBar } from './renderFilterBar.js';
import { renderLayout } from './renderLayout.js';
import { renderYearNav } from './renderYearNav.js';
import { themeType, type ThemeType } from './themeType.js';
import { allEntries } from './allEntries.js';
import { yearOf } from './yearOf.js';

const byTitle =
  (collation: string) =>
  (a: PublicEntry, b: PublicEntry): number =>
    a.title.localeCompare(b.title, collation);

const byRecent =
  (collation: string) =>
  (a: PublicEntry, b: PublicEntry): number =>
    (b.startedAt ?? '').localeCompare(a.startedAt ?? '') || byTitle(collation)(a, b);

function grid(library: Library, entries: PublicEntry[]): string {
  return `<div class="media-grid">${entries.map((entry) => renderCard(library, entry, null)).join('')}</div>`;
}

function inProgress(library: Library, entries: PublicEntry[]): string {
  const current = entries.filter((entry) => entryStatus(entry) === 'in_progress');
  if (current.length === 0) return '';
  return `<div class="home-section"><h3 class="section-title">${library.messages.statusLabels['in_progress']} (${current.length})</h3>${grid(library, [...current].sort(byRecent(library.messages.collation)))}</div><hr class="section-divider">`;
}

function completed(library: Library, entries: PublicEntry[], hasCurrent: boolean): string {
  const viewings = finishedViewings(entries, library.messages.collation);
  if (viewings.length === 0) {
    return hasCurrent ? '' : `<p>${library.messages.home.noneCompleted}</p>`;
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
    return `<div class="year-group"><h2 class="year-title" id="year-${id}">${escapeHtml(title)}</h2><div class="media-grid">${cards}</div></div>`;
  });
  return `<h3 class="section-title" id="completed-section">${library.messages.home.completed}</h3>${renderYearNav(viewings)}${groups.join('')}`;
}

function setAside(library: Library, entries: PublicEntry[]): string {
  const recent = byRecent(library.messages.collation);
  const paused = entries.filter((entry) => entryStatus(entry) === 'paused').sort(recent);
  const dropped = entries.filter((entry) => entryStatus(entry) === 'dropped').sort(recent);
  if (paused.length + dropped.length === 0) return '';
  const part = (title: string, group: PublicEntry[]): string =>
    group.length === 0 ? '' : `<h4 class="subsection-title">${title}</h4>${grid(library, group)}`;
  return `<hr class="section-divider" style="margin-top: 40px;"><details class="hidden-section-container" style="margin-top: 20px;"><summary style="cursor: pointer; opacity: 0.7; font-weight: bold; padding: 10px;">${library.messages.home.setAside(paused.length + dropped.length)}</summary>${part(library.messages.statusLabels['paused'] as string, paused)}${part(library.messages.statusLabels['dropped'] as string, dropped)}</details>`;
}

/** The library home: the profile, the search and filters, what is in progress, what is finished by year and, folded away, what is paused or dropped. */
export function renderHome(library: Library): string {
  const entries = homeEntries(library);
  const current = inProgress(library, entries);
  const shownTypes = [
    ...new Set(allEntries(library).map((entry) => themeType(entry.kind))),
  ] as ThemeType[];
  const main = `<main aria-label="Content">${renderFilterBar(allEntries(library), shownTypes, library.messages)}${current}${completed(library, entries, current !== '')}${setAside(library, entries)}</main>`;
  return renderLayout({
    library,
    title: ownerName(library),
    active: 'home',
    beforePage: '<div id="random-hero-banner"></div>',
    page: `<div class="wrapper">${renderBio(library)}${main}</div>`,
    scripts: ['banner.js', 'year-nav.js', 'filter.js'],
  });
}
