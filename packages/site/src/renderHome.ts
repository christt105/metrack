import { escapeHtml, statusKey } from '@metrack/export';
import { finishedViewings } from './finishedViewings.js';
import { homeSections, type HomeSection } from './homeSections.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import { renderCard } from './renderCard.js';
import { renderLayout } from './renderLayout.js';
import { STATUS_LABELS } from './labels.js';
import { yearOf } from './yearOf.js';

const byTitle = (a: PublicEntry, b: PublicEntry): number => a.title.localeCompare(b.title, 'es');

function grid(library: Library, entries: PublicEntry[]): string {
  return `<div class="media-grid">${entries.map((entry) => renderCard(library.handle, entry, null)).join('')}</div>`;
}

function inProgress(library: Library, entries: PublicEntry[]): string {
  const current = entries
    .filter((entry) => statusKey(entry.status) === 'in_progress')
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? '') || byTitle(a, b));
  return current.length === 0
    ? ''
    : `<h3 class="subsection-title">${STATUS_LABELS['in_progress']} (${current.length})</h3>${grid(library, current)}`;
}

function finished(library: Library, entries: PublicEntry[]): string {
  const viewings = finishedViewings(entries);
  if (viewings.length === 0) return '';
  const years = new Map<string, typeof viewings>();
  for (const viewing of viewings) {
    const year = yearOf(viewing.date) ?? '';
    years.set(year, [...(years.get(year) ?? []), viewing]);
  }
  const groups = [...years].map(([year, group]) => {
    const cards = group
      .map((viewing) => renderCard(library.handle, viewing.entry, viewing.date))
      .join('');
    const title = year === '' ? 'No recuerdo cuándo' : year;
    return `<div class="year-group"><h4 class="year-title">${escapeHtml(title)}</h4><div class="media-grid">${cards}</div></div>`;
  });
  return `<h3 class="subsection-title">Completado (${viewings.length})</h3>${groups.join('')}`;
}

function setAside(library: Library, entries: PublicEntry[]): string {
  const parts = ['paused', 'dropped', 'not_started'].flatMap((key) => {
    const matching = entries.filter((entry) => statusKey(entry.status) === key).sort(byTitle);
    return matching.length === 0
      ? []
      : [
          `<h4 class="subsection-title">${STATUS_LABELS[key]} (${matching.length})</h4>${grid(library, matching)}`,
        ];
  });
  if (parts.length === 0) return '';
  return `<details class="hidden-section-container"><summary>Pausados, abandonados y sin empezar</summary>${parts.join('')}</details>`;
}

function section(library: Library, { id, title, entries }: HomeSection): string {
  return `<section id="${id}"><h2 class="section-title">${escapeHtml(title)} (${entries.length})</h2>${inProgress(library, entries)}${finished(library, entries)}${setAside(library, entries)}</section>`;
}

/** The library home: one list per type, with what is in progress, what is finished by year and, folded away, the rest. */
export function renderHome(library: Library): string {
  const sections = homeSections(library);
  const nav = sections
    .map(
      (entry) => `<a href="#${entry.id}">${escapeHtml(entry.title)} (${entry.entries.length})</a>`,
    )
    .join('');
  const body =
    sections.length === 0
      ? '<p>Todavía no hay nada.</p>'
      : `<nav class="type-nav" aria-label="Secciones">${nav}</nav>${sections.map((entry) => section(library, entry)).join('<hr class="section-divider">')}`;
  return renderLayout({
    title: `@${library.handle}`,
    handle: library.handle,
    body: `<main aria-label="Contenido"><div class="profile-header"><h1>@${escapeHtml(library.handle)}</h1></div>${body}</main>`,
  });
}
