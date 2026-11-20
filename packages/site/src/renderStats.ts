import { escapeHtml } from '@metrack/export';
import { allEntries } from './allEntries.js';
import { entryStatus } from './entryStatus.js';
import { formatDecimal } from './formatDecimal.js';
import { formatInteger } from './formatInteger.js';
import type { Library } from './Library.js';
import { ownerName } from './ownerName.js';
import type { PublicEntry } from './PublicEntry.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { ratingScale } from './ratingTheme.js';
import { percentOf, renderStatBars, type StatBar } from './renderStatBars.js';
import { renderLayout } from './renderLayout.js';
import { renderTimeSpent } from './renderTimeSpent.js';
import { renderVariableStats } from './renderVariableStats.js';
import { completions, countNames } from './StatsCount.js';
import { TYPE_ICONS, themeType, type ThemeType } from './themeType.js';
import { yearOf } from './yearOf.js';

const TYPE_ORDER: ThemeType[] = ['book', 'movie', 'season', 'tv', 'videogame'];
const maxRating = (messages: SiteMessages): number => ratingScale(messages)[0]?.rating ?? 0;

function section(title: string, content: string): string {
  return `<section class="stats-section"><h2 class="section-title">${escapeHtml(title)}</h2>${content}</section>`;
}

function card(value: string, label: string, max?: number): string {
  const suffix = max === undefined ? '' : `<span class="stat-max">/ ${max}</span>`;
  return `<div class="stat-card"><span class="stat-number">${value}${suffix}</span><span class="stat-label">${escapeHtml(label)}</span></div>`;
}

function typeCards(messages: SiteMessages, entries: PublicEntry[], hideEmpty: boolean): string {
  return TYPE_ORDER.flatMap((type) => {
    const count = entries.filter((entry) => themeType(entry.kind) === type).length;
    if (count === 0 && (hideEmpty || type === 'book')) return [];
    return [
      card(
        `<i class="${TYPE_ICONS[type]}"></i> ${formatInteger(count, messages)}`,
        messages.typePlurals[type],
      ),
    ];
  }).join('');
}

function ratingBars(
  messages: SiteMessages,
  counts: Map<number, number>,
  hideEmpty: boolean,
): string {
  const max = Math.max(1, ...counts.values());
  const bars: StatBar[] = ratingScale(messages).flatMap((theme) => {
    const count = counts.get(theme.rating) ?? 0;
    if (hideEmpty && count === 0) return [];
    return [
      {
        name: `<i class="${theme.icon}" style="color:${theme.color}"></i> ${escapeHtml(theme.label)}`,
        percent: percentOf(count, max),
        value: formatInteger(count, messages),
        color: theme.color,
      },
    ];
  });
  return bars.length === 0 ? '' : section(messages.stats.ratingDistribution, renderStatBars(bars));
}

function average(ratings: number[]): number | null {
  return ratings.length === 0
    ? null
    : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function averageCard(messages: SiteMessages, ratings: number[]): string {
  const mean = average(ratings);
  return mean === null
    ? ''
    : card(formatDecimal(mean, messages), messages.stats.averageRating, maxRating(messages));
}

function weightedRatings(finished: PublicEntry[]): number[] {
  return finished.flatMap((entry) =>
    entry.rating === null ? [] : Array<number>(completions(entry)).fill(entry.rating),
  );
}

function allTime(
  messages: SiteMessages,
  media: PublicEntry[],
  finished: PublicEntry[],
  dated: Map<string, PublicEntry[]>,
): string {
  const ratings = weightedRatings(finished);
  const counts = new Map<number, number>();
  for (const rating of ratings) counts.set(rating, (counts.get(rating) ?? 0) + 1);
  const total = finished.reduce((sum, entry) => sum + completions(entry), 0);
  const cards = `<section class="stats-cards">${card(formatInteger(media.length, messages), messages.stats.total)}${card(formatInteger(total, messages), messages.stats.finished)}${typeCards(messages, media, false)}${averageCard(messages, ratings)}</section>`;

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
    value: formatInteger(count, messages),
  }));

  const scale = ratingScale(messages);
  const ratedYears = [...dated]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .flatMap(([year, entries]) => {
      const mean = average(
        entries.flatMap((entry) => (entry.rating === null ? [] : [entry.rating])),
      );
      if (mean === null) return [];
      const theme = scale.find((entry) => entry.rating === Math.round(mean));
      return [
        {
          name: year,
          percent: percentOf(mean, maxRating(messages)),
          value: formatDecimal(mean, messages),
          color: theme?.color ?? 'var(--primary-color,#4f8cff)',
          valueColor: theme?.color,
        } satisfies StatBar,
      ];
    });

  const genres = countNames(media.flatMap((entry) => entry.genres.filter(Boolean))).slice(0, 12);
  const maxGenre = genres[0]?.count ?? 1;

  return [
    cards,
    ratingBars(messages, counts, false),
    renderTimeSpent(messages, media, null),
    section(messages.stats.finishedPerYear, renderStatBars(yearBars)),
    ratedYears.length === 0
      ? ''
      : section(messages.stats.averageRatingPerYear, renderStatBars(ratedYears)),
    genres.length === 0
      ? ''
      : section(
          messages.stats.topGenres,
          renderStatBars(
            genres.map((genre) => ({
              name: escapeHtml(genre.name),
              percent: percentOf(genre.count, maxGenre),
              value: formatInteger(genre.count, messages),
            })),
          ),
        ),
    renderVariableStats(messages, finished),
  ].join('');
}

function oneYear(
  messages: SiteMessages,
  year: string,
  dated: Map<string, PublicEntry[]>,
  finished: PublicEntry[],
  media: PublicEntry[],
): string {
  const inYear = [
    ...(dated.get(year) ?? []),
    ...finished.flatMap((entry) =>
      entry.rewatches.filter((date) => yearOf(date) === year).map(() => entry),
    ),
  ];
  const ratings = inYear.flatMap((entry) => (entry.rating === null ? [] : [entry.rating]));
  const counts = new Map<number, number>();
  for (const rating of ratings) counts.set(rating, (counts.get(rating) ?? 0) + 1);
  const cards = `<section class="stats-cards">${card(formatInteger(inYear.length, messages), messages.stats.finished)}${typeCards(messages, inYear, true)}${averageCard(messages, ratings)}</section>`;
  return `<div data-stats-year="${year}" hidden>${cards}${ratingBars(messages, counts, true)}${renderTimeSpent(messages, media, year)}${renderVariableStats(messages, inYear)}</div>`;
}

/** The statistics page: totals, ratings, finished per year, genres, platforms and more, all computed here, with a year selector. */
export function renderStats(library: Library): string {
  const { messages } = library;
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
      : `<div class="stats-year-filter"><label for="stats-year-select">${messages.stats.yearSelector}</label><select id="stats-year-select"><option value="all">${messages.stats.allYears}</option>${years.map((year) => `<option value="${year}">${year}</option>`).join('')}</select></div>`;
  const blocks = `<div data-stats-year="all">${allTime(messages, media, finished, dated)}</div>${years.map((year) => oneYear(messages, year, dated, finished, media)).join('')}`;
  return renderLayout({
    library,
    title: `${messages.stats.title} | ${ownerName(library)}`,
    active: 'stats',
    page: `<div class="wrapper stats-page"><header class="header"><h1 class="header-title center">${messages.stats.title}</h1></header><main class="page-content" aria-label="${messages.contentLabel}">${selector}${blocks}</main></div>`,
    scripts: ['stats.js'],
  });
}
