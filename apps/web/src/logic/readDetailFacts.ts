import { movieTimeSpent, type Movie } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import type { DetailFacts } from './DetailFacts';

function text(detail: AnyDetail, key: string): string | null {
  const value = (detail as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function list(detail: AnyDetail, key: string): string[] {
  const value = (detail as unknown as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function timeSpentOf(detail: AnyDetail): { minutes: number | null; durationUnknown: boolean } {
  const record = detail as unknown as Record<string, unknown>;
  if ('runtime' in detail) {
    const movie = detail as Movie;
    const minutes = movieTimeSpent(movie)?.minutes ?? null;
    return {
      minutes,
      durationUnknown: movie.status === 'completed' && minutes === null,
    };
  }
  const stored = record.timeSpentMinutes;
  return {
    minutes: typeof stored === 'number' && stored > 0 ? stored : null,
    durationUnknown: false,
  };
}

/** What the header of a detail page shows about any kind of title, read from whichever fields it has. */
export function readDetailFacts(detail: AnyDetail): DetailFacts {
  const date = text(detail, 'releaseDate') ?? text(detail, 'firstAirDate');
  const people = [
    text(detail, 'director'),
    text(detail, 'developer'),
    ...list(detail, 'authors'),
  ].filter((value): value is string => value !== null);
  const time = timeSpentOf(detail);
  return {
    year: date ? date.slice(0, 4) : null,
    originalTitle: text(detail, 'originalTitle'),
    overview: text(detail, 'overview'),
    genres: list(detail, 'genres'),
    people,
    cast: list(detail, 'cast').slice(0, 8),
    platforms: list(detail, 'platforms'),
    episodeCount:
      typeof (detail as unknown as Record<string, unknown>).episodeCount === 'number'
        ? ((detail as unknown as Record<string, unknown>).episodeCount as number)
        : null,
    rating: 'rating' in detail ? detail.rating : null,
    review: text(detail, 'review'),
    timeSpentMinutes: time.minutes,
    durationUnknown: time.durationUnknown,
  };
}
