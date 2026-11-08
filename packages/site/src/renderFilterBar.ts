import { escapeHtml } from '@metrack/export';
import type { PublicEntry } from './PublicEntry.js';
import { RATING_SCALE } from './ratingTheme.js';
import { STATUS_LABELS, TYPE_LABELS } from './labels.js';
import { TYPE_ICONS, type ThemeType } from './themeType.js';

const FILTER_TYPES: ThemeType[] = ['movie', 'tv', 'videogame', 'book'];
const FILTER_STATUSES = ['finished', 'in_progress', 'paused', 'dropped', 'not_started'];

interface Choice {
  label: string;
  value: string;
}

function distinct(values: string[]): Choice[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (value !== '' && !seen.has(key)) seen.set(key, value);
  }
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

const ALL = (label: string): string =>
  `<button type="button" class="filter-chip active" data-value="">${label}</button>`;

const chip = (value: string, label: string): string =>
  `<button type="button" class="filter-chip" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;

/** The search box and the filter chips of the home; the filtering itself is done by the shared script over the rendered cards. */
export function renderFilterBar(entries: PublicEntry[], shownTypes: ThemeType[]): string {
  const types = FILTER_TYPES.filter((type) => shownTypes.includes(type))
    .map(
      (type) =>
        `<button type="button" class="filter-chip" data-value="${type}"><i class="${TYPE_ICONS[type]}" aria-hidden="true"></i> ${TYPE_LABELS[type]}</button>`,
    )
    .join('');
  const statuses = FILTER_STATUSES.map((status) =>
    chip(status, STATUS_LABELS[status] ?? status),
  ).join('');
  const ratings = RATING_SCALE.map(
    (theme) =>
      `<button type="button" class="filter-chip" data-value="${theme.rating}" title="${escapeHtml(theme.label)}" style="--chip-accent: ${theme.color}"><i class="${theme.icon}" aria-hidden="true"></i></button>`,
  ).join('');
  const platforms = distinct(entries.flatMap((entry) => entry.platforms));
  const tags = distinct(entries.flatMap((entry) => entry.tags));
  const advanced =
    platforms.length === 0 && tags.length === 0
      ? ''
      : `<details class="filter-advanced"><summary>Más</summary>${
          platforms.length === 0
            ? ''
            : `<div class="filter-chips" data-filter-group="platform">${ALL('Plataformas')}${platforms.map((entry) => chip(entry.value, entry.label)).join('')}</div>`
        }${
          tags.length === 0
            ? ''
            : `<div class="filter-chips" data-filter-group="tag">${ALL('Etiquetas')}${tags.map((entry) => chip(entry.value, `#${entry.label}`)).join('')}</div>`
        }</details>`;
  return `<div class="filter-bar" id="filter-bar"><div class="filter-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" id="media-search" autocomplete="off" placeholder="Buscar por título o género..." aria-label="Buscar por título o género..."></div><div class="filter-row"><div class="filter-chips" data-filter-group="type">${ALL('Todos')}${types}</div><div class="filter-chips" data-filter-group="status">${ALL('Todos')}${statuses}</div><div class="filter-chips filter-ratings" data-filter-group="rating">${ALL('Todos')}${ratings}</div></div>${advanced}<p class="filter-noresults" id="filter-noresults" hidden>No hay resultados.</p></div>`;
}
