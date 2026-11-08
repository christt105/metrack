import { escapeHtml } from '@metrack/export';
import { allEntries } from './allEntries.js';
import { entryStatus } from './entryStatus.js';
import { formatDecimal } from './formatDecimal.js';
import type { Library } from './Library.js';
import { TYPE_PLURALS } from './labels.js';
import { ownerName } from './ownerName.js';
import type { PublicEntry } from './PublicEntry.js';
import { RATING_SCALE } from './ratingTheme.js';
import { percentOf, renderStatBars, type StatBar } from './renderStatBars.js';
import { renderLayout } from './renderLayout.js';
import { renderVariableStats } from './renderVariableStats.js';
import { completions, countNames } from './StatsCount.js';
import { TYPE_ICONS, themeType, type ThemeType } from './themeType.js';
import { yearOf } from './yearOf.js';

const TYPE_ORDER: ThemeType[] = ['book', 'movie', 'season', 'tv', 'videogame'];
const MAX_RATING = RATING_SCALE[0]?.rating ?? 0;

function section(title: string, content: string): string {
  return `<section class="stats-section"><h2 class="section-title">${escapeHtml(title)}</h2>${content}</section>`;
}

function card(value: string, label: string, max?: number): string {
  const suffix = max === undefined ? '' : `<span class="stat-max">/ ${max}</span>`;
  return `<div class="stat-card"><span class="stat-number">${value}${suffix}</span><span class="stat-label">${escapeHtml(label)}</span></div>`;
}

function typeCards(entries: PublicEntry[], hideEmpty: boolean): string {
  return TYPE_ORDER.flatMap((type) => {
    const count = entries.filter((entry) => themeType(entry.kind) === type).length;
    if (count === 0 && (hideEmpty || type === 'book')) return [];
    return [card(`<i class="${TYPE_ICONS[type]}"></i> ${count}`, TYPE_PLURALS[type])];
  }).join('');
}

function ratingBars(counts: Map<number, number>, hideEmpty: boolean): string {
  const max = Math.max(1, ...counts.values());
  const bars: StatBar[] = RATING_SCALE.flatMap((theme) => {
    const count = counts.get(theme.rating) ?? 0;
    if (hideEmpty && count === 0) return [];
    return [
      {
        name: `<i class="${theme.icon}" style="color:${theme.color}"></i> ${escapeHtml(theme.label)}`,
        percent: percentOf(count, max),
        value: String(count),
        color: theme.color,
      },
    ];
  });
  return bars.length === 0 ? '' : section('Distribución de notas', renderStatBars(bars));
}

function average(ratings: number[]): number | null {
  return ratings.length === 0
    ? null
    : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function averageCard(ratings: number[]): string {
  const mean = average(ratings);
  return mean === null ? '' : card(formatDecimal(mean), 'Nota media', MAX_RATING);
}

function weightedRatings(finished: PublicEntry[]): number[] {
  return finished.flatMap((entry) =>
    entry.rating === null ? [] : Array<number>(completions(entry)).fill(entry.rating),
  );
}

function allTime(
  media: PublicEntry[],
  finished: PublicEntry[],
  dated: Map<string, PublicEntry[]>,
): string {
  const ratings = weightedRatings(finished);
  const counts = new Map<number, number>();
  for (const rating of ratings) counts.set(rating, (counts.get(rating) ?? 0) + 1);
  const total = finished.reduce((sum, entry) => sum + completions(entry), 0);
  const cards = `<section class="stats-cards">${card(String(media.length), 'Total')}${card(String(total), 'Acabados')}${typeCards(media, false)}${averageCard(ratings)}</section>`;

  const perYear = new Map<string, number>();
  for (const entry of finished) {
    for (const date of [entry.finishedAt, ...entry.rewatches]) {
      const year = yearOf(date);
      if (year !== null) perYear.set(year, (perYear.get(year) ?? 0) + 1);
    }
  }
  const yearList = [...perYear].sort((a, b) => b[0].localeCompare(a[0]));
  const maxYear = Math.max(1, ...perYear.values());
  const yearBars: StatBar[] = yearList.map(([year, count]) => ({
    name: year,
    percent: percentOf(count, maxYear),
    value: String(count),
  }));

  const ratedYears = [...dated]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .flatMap(([year, entries]) => {
      const mean = average(
        entries.flatMap((entry) => (entry.rating === null ? [] : [entry.rating])),
      );
      if (mean === null) return [];
      const theme = RATING_SCALE.find((entry) => entry.rating === Math.round(mean));
      return [
        {
          name: year,
          percent: percentOf(mean, MAX_RATING),
          value: formatDecimal(mean),
          color: theme?.color ?? 'var(--primary-color,#4f8cff)',
          valueColor: theme?.color,
        } satisfies StatBar,
      ];
    });

  const genres = countNames(media.flatMap((entry) => entry.genres.filter(Boolean))).slice(0, 12);
  const maxGenre = genres[0]?.count ?? 1;

  return [
    cards,
    ratingBars(counts, false),
    section('Acabados por año', renderStatBars(yearBars)),
    ratedYears.length === 0 ? '' : section('Nota media por año', renderStatBars(ratedYears)),
    genres.length === 0
      ? ''
      : section(
          'Géneros más frecuentes',
          renderStatBars(
            genres.map((genre) => ({
              name: escapeHtml(genre.name),
              percent: percentOf(genre.count, maxGenre),
              value: String(genre.count),
            })),
          ),
        ),
    renderVariableStats(finished),
  ].join('');
}

function oneYear(year: string, dated: Map<string, PublicEntry[]>, finished: PublicEntry[]): string {
  const inYear = [
    ...(dated.get(year) ?? []),
    ...finished.flatMap((entry) =>
      entry.rewatches.filter((date) => yearOf(date) === year).map(() => entry),
    ),
  ];
  const ratings = inYear.flatMap((entry) => (entry.rating === null ? [] : [entry.rating]));
  const counts = new Map<number, number>();
  for (const rating of ratings) counts.set(rating, (counts.get(rating) ?? 0) + 1);
  const cards = `<section class="stats-cards">${card(String(inYear.length), 'Acabados')}${typeCards(inYear, true)}${averageCard(ratings)}</section>`;
  return `<div data-stats-year="${year}" hidden>${cards}${ratingBars(counts, true)}${renderVariableStats(inYear)}</div>`;
}

/** The statistics page: totals, ratings, finished per year, genres, platforms and more, all computed here, with a year selector. */
export function renderStats(library: Library): string {
  const media = allEntries(library);
  const finished = media.filter((entry) => entryStatus(entry) === 'finished');
  const dated = new Map<string, PublicEntry[]>();
  for (const entry of finished) {
    const year = yearOf(entry.finishedAt);
    if (year !== null) dated.set(year, [...(dated.get(year) ?? []), entry]);
  }
  const years = [...dated.keys()].sort().reverse();
  const selector =
    years.length === 0
      ? ''
      : `<div class="stats-year-filter"><label for="stats-year-select">Acabados por año:</label><select id="stats-year-select"><option value="all">Todos</option>${years.map((year) => `<option value="${year}">${year}</option>`).join('')}</select></div>`;
  const blocks = `<div data-stats-year="all">${allTime(media, finished, dated)}</div>${years.map((year) => oneYear(year, dated, finished)).join('')}`;
  return renderLayout({
    library,
    title: `Estadísticas | ${ownerName(library)}`,
    active: 'stats',
    page: `<div class="wrapper stats-page"><header class="header"><h1 class="header-title center">Estadísticas</h1></header><main class="page-content" aria-label="Content">${selector}${blocks}</main></div>`,
    scripts: ['stats.js'],
  });
}
