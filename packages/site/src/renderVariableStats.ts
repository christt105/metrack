import { escapeHtml } from '@metrack/export';
import { formatInteger } from './formatInteger.js';
import { entryStatus } from './entryStatus.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import type { PublicEntry } from './PublicEntry.js';
import { countNames } from './StatsCount.js';
import { percentOf } from './renderStatBars.js';
import { pieColor, renderStatsSplit } from './renderStatsSplit.js';

function isAnime(entry: PublicEntry): boolean {
  return (
    entry.genres.some((genre) => ['anime', 'animation'].includes(genre.toLowerCase())) ||
    entry.tags.some((tag) => tag.toLowerCase() === 'anime')
  );
}

function isCinema(entry: PublicEntry): boolean {
  return entry.tags.some((tag) => ['cinema', 'cine'].includes(tag.toLowerCase()));
}

function twoWay(
  messages: SiteMessages,
  title: string,
  first: { name: string; count: number; color: string },
  second: { name: string; count: number; color: string },
  of: number,
): string {
  const firstPercent = Math.round((first.count / of) * 100);
  const secondPercent = 100 - firstPercent;
  return renderStatsSplit(
    title,
    [
      {
        name: escapeHtml(first.name),
        percent: firstPercent,
        value: formatInteger(first.count, messages),
        color: first.color,
      },
      {
        name: escapeHtml(second.name),
        percent: secondPercent,
        value: formatInteger(second.count, messages),
        color: second.color,
      },
    ],
    [
      { ...first, percent: firstPercent },
      { ...second, percent: secondPercent },
    ],
  );
}

/** The platform, anime and cinema sections for a set of finished items; each appears only when it has something to show. */
export function renderVariableStats(messages: SiteMessages, finished: PublicEntry[]): string {
  const { stats } = messages;
  const sections: string[] = [];
  const platforms = countNames(
    finished
      .filter((entry) => entry.kind === 'videogame')
      .flatMap((entry) => entry.platforms.filter(Boolean)),
  );
  if (platforms.length > 0) {
    const max = platforms[0]?.count ?? 1;
    sections.push(
      renderStatsSplit(
        stats.platforms,
        platforms.map((entry) => ({
          name: escapeHtml(entry.name),
          percent: percentOf(entry.count, max),
          value: formatInteger(entry.count, messages),
        })),
        platforms.map((entry, index) => ({ ...entry, color: pieColor(index) })),
      ),
    );
  }
  const anime = finished.filter(isAnime).length;
  if (anime > 0 && finished.length > 0) {
    sections.push(
      twoWay(
        messages,
        stats.animeContent,
        { name: stats.anime, count: anime, color: pieColor(9) },
        { name: stats.nonAnime, count: finished.length - anime, color: pieColor(0) },
        finished.length,
      ),
    );
  }
  const movies = finished.filter(
    (entry) => entry.kind === 'movie' && entryStatus(entry) === 'finished',
  );
  const cinema = movies.filter(isCinema).length;
  if (cinema > 0 && movies.length > 0) {
    sections.push(
      twoWay(
        messages,
        stats.cinemaVsStreaming,
        { name: stats.cinema, count: cinema, color: pieColor(1) },
        { name: stats.streaming, count: movies.length - cinema, color: pieColor(0) },
        movies.length,
      ),
    );
  }
  return sections.join('');
}
