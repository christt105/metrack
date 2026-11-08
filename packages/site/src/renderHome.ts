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
import { STATUS_LABELS } from './labels.js';
import { themeType, type ThemeType } from './themeType.js';
import { allEntries } from './allEntries.js';
import { yearOf } from './yearOf.js';

const byTitle = (a: PublicEntry, b: PublicEntry): number => a.title.localeCompare(b.title, 'es');

const byRecent = (a: PublicEntry, b: PublicEntry): number =>
  (b.startedAt ?? '').localeCompare(a.startedAt ?? '') || byTitle(a, b);

function grid(library: Library, entries: PublicEntry[]): string {
  return `<div class="media-grid">${entries.map((entry) => renderCard(library.handle, entry, null)).join('')}</div>`;
}

function inProgress(library: Library, entries: PublicEntry[]): string {
  const current = entries.filter((entry) => entryStatus(entry) === 'in_progress');
  if (current.length === 0) return '';
  return `<div class="home-section"><h3 class="section-title">${STATUS_LABELS['in_progress']} (${current.length})</h3>${grid(library, [...current].sort(byRecent))}</div><hr class="section-divider">`;
}

function completed(library: Library, entries: PublicEntry[], hasCurrent: boolean): string {
  const viewings = finishedViewings(entries);
  if (viewings.length === 0) {
    return hasCurrent ? '' : '<p>Aún no hay elementos completados.</p>';
  }
  const years = new Map<string, typeof viewings>();
  for (const viewing of viewings) {
    const year = yearOf(viewing.date) ?? '';
    years.set(year, [...(years.get(year) ?? []), viewing]);
  }
  const groups = [...years].map(([year, group]) => {
    const id = year === '' ? 'unknown' : year;
    const title = year === '' ? 'No recuerdo cuándo' : year;
    const cards = group
      .map((viewing) => renderCard(library.handle, viewing.entry, viewing.date))
      .join('');
    return `<div class="year-group"><h2 class="year-title" id="year-${id}">${escapeHtml(title)}</h2><div class="media-grid">${cards}</div></div>`;
  });
  return `<h3 class="section-title" id="completed-section">Completado</h3>${renderYearNav(viewings)}${groups.join('')}`;
}

function setAside(library: Library, entries: PublicEntry[]): string {
  const paused = entries.filter((entry) => entryStatus(entry) === 'paused').sort(byRecent);
  const dropped = entries.filter((entry) => entryStatus(entry) === 'dropped').sort(byRecent);
  if (paused.length + dropped.length === 0) return '';
  const part = (title: string, group: PublicEntry[]): string =>
    group.length === 0 ? '' : `<h4 class="subsection-title">${title}</h4>${grid(library, group)}`;
  return `<hr class="section-divider" style="margin-top: 40px;"><details class="hidden-section-container" style="margin-top: 20px;"><summary style="cursor: pointer; opacity: 0.7; font-weight: bold; padding: 10px;">Ver Pausados y Abandonados (${paused.length + dropped.length})</summary>${part(STATUS_LABELS['paused'] as string, paused)}${part(STATUS_LABELS['dropped'] as string, dropped)}</details>`;
}

/** The library home: the profile, the search and filters, what is in progress, what is finished by year and, folded away, what is paused or dropped. */
export function renderHome(library: Library): string {
  const entries = homeEntries(library);
  const current = inProgress(library, entries);
  const shownTypes = [
    ...new Set(allEntries(library).map((entry) => themeType(entry.kind))),
  ] as ThemeType[];
  const main = `<main aria-label="Content">${renderFilterBar(allEntries(library), shownTypes)}${current}${completed(library, entries, current !== '')}${setAside(library, entries)}</main>`;
  return renderLayout({
    library,
    title: ownerName(library),
    active: 'home',
    beforePage: '<div id="random-hero-banner"></div>',
    page: `<div class="wrapper">${renderBio(library)}${main}</div>`,
    scripts: ['banner.js', 'year-nav.js', 'filter.js'],
  });
}
