import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import type { PublicEntry } from './PublicEntry.js';
import { ratingScale } from './ratingTheme.js';
import { TYPE_ICONS, type ThemeType } from './themeType.js';

const FILTER_TYPES: ThemeType[] = ['movie', 'tv', 'videogame', 'book'];
const FILTER_STATUSES = ['finished', 'in_progress', 'paused', 'dropped', 'not_started'];

interface Choice {
  label: string;
  value: string;
}

function distinct(values: string[], collation: string): Choice[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (value !== '' && !seen.has(key)) seen.set(key, value);
  }
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, collation));
}

const ALL = (label: string): string =>
  `<button type="button" class="filter-chip active" data-value="">${label}</button>`;

const group = (name: string, all: string, chips: string, extraClass = ''): string =>
  chips === ''
    ? ''
    : `<div class="filter-chips${extraClass}" data-filter-group="${name}">${ALL(all)}${chips}</div>`;

const chip = (value: string, label: string): string =>
  `<button type="button" class="filter-chip" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;

/** The search box and the filter chips of the home; the filtering itself is done by the shared script over the rendered cards. */
export function renderFilterBar(
  entries: PublicEntry[],
  shownTypes: ThemeType[],
  messages: SiteMessages,
): string {
  const { filter } = messages;
  const types = FILTER_TYPES.filter((type) => shownTypes.includes(type))
    .map(
      (type) =>
        `<button type="button" class="filter-chip" data-value="${type}"><i class="${TYPE_ICONS[type]}" aria-hidden="true"></i> ${messages.typeLabels[type]}</button>`,
    )
    .join('');
  const present = new Set(entries.map(entryStatus));
  const statuses = FILTER_STATUSES.filter((status) => present.has(status))
    .map((status) => chip(status, messages.statusLabels[status] ?? status))
    .join('');
  const rated = new Set(
    entries
      .filter((entry) => entryStatus(entry) === 'finished' && entry.rating !== null)
      .map((entry) => entry.rating),
  );
  const ratings = ratingScale(messages)
    .filter((theme) => rated.has(theme.rating))
    .map(
      (theme) =>
        `<button type="button" class="filter-chip" data-value="${theme.rating}" title="${escapeHtml(theme.label)}" style="--chip-accent: ${theme.color}"><i class="${theme.icon}" aria-hidden="true"></i></button>`,
    )
    .join('');
  const platforms = distinct(
    entries.flatMap((entry) => entry.platforms),
    messages.collation,
  );
  const tags = distinct(
    entries.flatMap((entry) => entry.tags),
    messages.collation,
  );
  const advanced =
    platforms.length === 0 && tags.length === 0
      ? ''
      : `<details class="filter-advanced"><summary>${filter.more}</summary>${group(
          'platform',
          filter.platforms,
          platforms.map((entry) => chip(entry.value, entry.label)).join(''),
        )}${group(
          'tag',
          filter.tags,
          tags.map((entry) => chip(entry.value, `#${entry.label}`)).join(''),
        )}</details>`;
  return `<div class="filter-bar" id="filter-bar"><div class="filter-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" id="media-search" autocomplete="off" placeholder="${filter.search}" aria-label="${filter.search}"></div><div class="filter-row">${group('type', filter.all, types)}${group('status', filter.all, statuses)}${group('rating', filter.all, ratings, ' filter-ratings')}</div>${advanced}<p class="filter-noresults" id="filter-noresults" hidden>${filter.noResults}</p></div>`;
}
