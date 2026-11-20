import { escapeHtml } from '@metrack/export';
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
        value: String(first.count),
        color: first.color,
      },
      {
        name: escapeHtml(second.name),
        percent: secondPercent,
        value: String(second.count),
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
          value: String(entry.count),
        })),
        platforms.map((entry, index) => ({ ...entry, color: pieColor(index) })),
      ),
    );
  }
  const anime = finished.filter(isAnime).length;
  if (anime > 0 && finished.length > 0) {
    sections.push(
      twoWay(
        stats.animeContent,
        { name: stats.anime, count: anime, color: '#a855f7' },
        { name: stats.nonAnime, count: finished.length - anime, color: '#4f8cff' },
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
        stats.cinemaVsStreaming,
        { name: stats.cinema, count: cinema, color: '#f59e0b' },
        { name: stats.streaming, count: movies.length - cinema, color: '#22c55e' },
        movies.length,
      ),
    );
  }
  return sections.join('');
}
