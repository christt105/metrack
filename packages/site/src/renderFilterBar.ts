import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { icon } from './icon.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import type { PublicEntry } from './PublicEntry.js';
import { ratingClass, ratingScale } from './ratingTheme.js';
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
  `<button type="button" class="chip" data-value="" aria-pressed="true">${label}</button>`;

const group = (name: string, all: string, chips: string, extraClass = ''): string =>
  chips === ''
    ? ''
    : `<div class="chips${extraClass}" data-filter-group="${name}">${ALL(all)}${chips}</div>`;

const chip = (value: string, label: string, extra = '', title = ''): string =>
  `<button type="button" class="chip${extra}" data-value="${escapeHtml(value)}" aria-pressed="false"${title === '' ? '' : ` title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"`}>${label}</button>`;

/** The search box and the filter chips of the home; the filtering itself is done by the shared script over the rendered cards. */
export function renderFilterBar(
  entries: PublicEntry[],
  shownTypes: ThemeType[],
  messages: SiteMessages,
): string {
  const { filter } = messages;
  const types = FILTER_TYPES.filter((type) => shownTypes.includes(type))
    .map((type) => chip(type, `${icon(TYPE_ICONS[type], 16)} ${messages.typeLabels[type]}`))
    .join('');
  const present = new Set(entries.map(entryStatus));
  const statuses = FILTER_STATUSES.filter((status) => present.has(status))
    .map((status) => chip(status, escapeHtml(messages.statusLabels[status] ?? status)))
    .join('');
  const rated = new Set(
    entries
      .filter((entry) => entryStatus(entry) === 'finished' && entry.rating !== null)
      .map((entry) => entry.rating),
  );
  const ratings = ratingScale(messages)
    .filter((theme) => rated.has(theme.rating))
    .map((theme) =>
      chip(
        String(theme.rating),
        icon(theme.icon, 18),
        ` chip-rating ${ratingClass(theme.rating)}`,
        theme.label,
      ),
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
      : `<details class="filter-more"><summary>${icon('sliders', 16)} ${filter.more}</summary>${group(
          'platform',
          filter.platforms,
          platforms.map((entry) => chip(entry.value, escapeHtml(entry.label))).join(''),
        )}${group(
          'tag',
          filter.tags,
          tags.map((entry) => chip(entry.value, `#${escapeHtml(entry.label)}`)).join(''),
        )}</details>`;
  return `<div class="filter-bar" id="filter-bar"><label class="search">${icon('search', 18)}<input type="search" id="media-search" autocomplete="off" placeholder="${filter.search}" aria-label="${filter.search}"></label><div class="filter-rows">${group('type', filter.all, types)}${group('status', filter.all, statuses)}${group('rating', filter.all, ratings, ' chips-ratings')}</div>${advanced}<p class="filter-empty" id="filter-empty" hidden>${filter.noResults}</p></div>`;
}
