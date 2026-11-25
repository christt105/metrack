import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { formatHours } from './formatHours.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import type { PublicEntry } from './PublicEntry.js';
import { percentOf, renderStatBars, type StatBar } from './renderStatBars.js';
import { icon } from './icon.js';
import { TYPE_ICONS, themeType, type ThemeType } from './themeType.js';
import { yearOf } from './yearOf.js';

const TYPE_ORDER: ThemeType[] = ['movie', 'season', 'videogame', 'book'];

function section(title: string, content: string): string {
  return `<section class="stats-section"><h2 class="section-title">${escapeHtml(title)}</h2>${content}</section>`;
}

function minutesIn(entry: PublicEntry, year: string | null): number {
  if (entry.timeSpent === null) return 0;
  return year === null ? entry.timeSpent.minutes : (entry.timeSpent.byYear[year] ?? 0);
}

function card(value: string, label: string): string {
  return `<div class="stat-card"><span class="stat-number">${value}</span><span class="stat-label">${escapeHtml(label)}</span></div>`;
}

function missingNote(messages: SiteMessages, entries: PublicEntry[], year: string | null): string {
  const missing = entries.filter(
    (entry) =>
      (entry.kind === 'videogame' || entry.kind === 'book') &&
      entryStatus(entry) === 'finished' &&
      entry.timeSpent === null &&
      (year === null || yearOf(entry.finishedAt) === year),
  ).length;
  return missing === 0
    ? ''
    : `<p class="note">${escapeHtml(messages.stats.timeMissing(missing))}</p>`;
}

/**
 * The hours section of the statistics page: the total and the hours of each type, and with `year` null also the hours per year. Items without data count for nothing; finished games and books without hours are counted apart.
 */
export function renderTimeSpent(
  messages: SiteMessages,
  entries: PublicEntry[],
  year: string | null,
): string {
  const perType = new Map<ThemeType, number>();
  for (const entry of entries) {
    const minutes = minutesIn(entry, year);
    if (minutes === 0) continue;
    const type = themeType(entry.kind);
    perType.set(type, (perType.get(type) ?? 0) + minutes);
  }
  const total = [...perType.values()].reduce((sum, minutes) => sum + minutes, 0);
  const note = missingNote(messages, entries, year);
  if (total === 0 && note === '') return '';
  const cards =
    total === 0
      ? ''
      : `<section class="stat-cards">${card(formatHours(total, messages), messages.stats.total)}${TYPE_ORDER.flatMap(
          (type) => {
            const minutes = perType.get(type);
            return minutes === undefined
              ? []
              : [
                  card(
                    `${icon(TYPE_ICONS[type], 20)} ${formatHours(minutes, messages)}`,
                    messages.typePlurals[type],
                  ),
                ];
          },
        ).join('')}</section>`;
  const sections = [section(messages.stats.timeSpent, `${cards}${note}`)];
  if (year === null) {
    const perYear = new Map<string, number>();
    for (const entry of entries) {
      for (const [key, minutes] of Object.entries(entry.timeSpent?.byYear ?? {})) {
        perYear.set(key, (perYear.get(key) ?? 0) + minutes);
      }
    }
    const max = Math.max(1, ...perYear.values());
    const bars: StatBar[] = [...perYear]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, minutes]) => ({
        name: key,
        percent: percentOf(minutes, max),
        value: formatHours(minutes, messages),
      }));
    if (bars.length > 0)
      sections.push(section(messages.stats.timeSpentPerYear, renderStatBars(bars)));
  }
  return sections.join('');
}
