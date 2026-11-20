import { escapeHtml } from '@metrack/export';
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
  const statuses = FILTER_STATUSES.map((status) =>
    chip(status, messages.statusLabels[status] ?? status),
  ).join('');
  const ratings = ratingScale(messages)
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
      : `<details class="filter-advanced"><summary>${filter.more}</summary>${
          platforms.length === 0
            ? ''
            : `<div class="filter-chips" data-filter-group="platform">${ALL(filter.platforms)}${platforms.map((entry) => chip(entry.value, entry.label)).join('')}</div>`
        }${
          tags.length === 0
            ? ''
            : `<div class="filter-chips" data-filter-group="tag">${ALL(filter.tags)}${tags.map((entry) => chip(entry.value, `#${entry.label}`)).join('')}</div>`
        }</details>`;
  return `<div class="filter-bar" id="filter-bar"><div class="filter-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" id="media-search" autocomplete="off" placeholder="${filter.search}" aria-label="${filter.search}"></div><div class="filter-row"><div class="filter-chips" data-filter-group="type">${ALL(filter.all)}${types}</div><div class="filter-chips" data-filter-group="status">${ALL(filter.all)}${statuses}</div><div class="filter-chips filter-ratings" data-filter-group="rating">${ALL(filter.all)}${ratings}</div></div>${advanced}<p class="filter-noresults" id="filter-noresults" hidden>${filter.noResults}</p></div>`;
}
