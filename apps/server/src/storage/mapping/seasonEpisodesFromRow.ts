import type { Episode, EpisodeSource, SeasonEpisodes } from '@metrack/domain';
import type { Row } from './Row.js';

/** Reads a stored episode list, skipping entries that have no episode number. */
export function parseEpisodes(value: unknown): Episode[] {
  const parsed: unknown = JSON.parse(String(value));
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item): Episode[] => {
    if (typeof item !== 'object' || item === null) return [];
    const e = item as Record<string, unknown>;
    if (typeof e.number !== 'number') return [];
    const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);
    const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
    return [
      {
        number: e.number,
        title: text(e.title),
        airDate: text(e.airDate),
        runtime: num(e.runtime),
        tmdbId: num(e.tmdbId),
        overview: text(e.overview),
        stillPath: text(e.stillPath),
      },
    ];
  });
}

export function seasonEpisodesFromRow(row: Row): SeasonEpisodes {
  return {
    seasonId: Number(row.season_id),
    episodes: parseEpisodes(row.episodes),
    source: String(row.source) as EpisodeSource,
    fetchedAt: String(row.fetched_at),
    complete: Number(row.complete) !== 0,
  };
}

export function seasonEpisodesToRow(
  catalog: SeasonEpisodes,
): [number, string, string, string, number] {
  return [
    catalog.seasonId,
    JSON.stringify(catalog.episodes),
    catalog.source,
    catalog.fetchedAt,
    catalog.complete ? 1 : 0,
  ];
}
