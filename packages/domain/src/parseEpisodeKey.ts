import type { ParsedEpisodeKey } from './ParsedEpisodeKey.js';

/** Reads a key made by `episodeKey`; null when it is neither a positive TMDB id nor `s<season>e<episode>`. */
export function parseEpisodeKey(key: string): ParsedEpisodeKey | null {
  if (/^[1-9]\d*$/.test(key)) return { kind: 'tmdb', tmdbId: Number(key) };
  const match = /^s(\d+)e([1-9]\d*)$/.exec(key);
  if (!match) return null;
  return { kind: 'number', seasonNumber: Number(match[1]), episodeNumber: Number(match[2]) };
}
