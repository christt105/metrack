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
