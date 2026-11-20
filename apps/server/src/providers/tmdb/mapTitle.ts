import { TMDB_IMAGE_BASE } from './TmdbClient.js';
import type { TmdbTitleResponse } from './TmdbTitleResponse.js';

export function imageUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_IMAGE_BASE}${path}` : null;
}

export function mapCast(response: TmdbTitleResponse): string[] {
  return (response.credits?.cast ?? []).slice(0, 10).map((a) => `${a.name} (${a.character})`);
}

export function mapGenres(response: TmdbTitleResponse): string[] {
  return (response.genres ?? []).map((g) => g.name);
}

export function clean(text: string | undefined): string | null {
  const value = (text ?? '').replace(/[\r\n]+/g, ' ').trim();
  return value === '' ? null : value;
}

export function emptyToNull(text: string | undefined): string | null {
  return text ? text : null;
}

export function positiveMinutes(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

export function seriesEpisodeRuntime(values: readonly number[] | undefined): number | null {
  const known = (values ?? []).filter((value) => value > 0);
  if (known.length === 0) return null;
  return positiveMinutes(known.reduce((sum, value) => sum + value, 0) / known.length);
}
