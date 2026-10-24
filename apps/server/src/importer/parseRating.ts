import { readText } from './fieldReaders.js';

export type RatingRead = { value: number | null; odd: boolean };

/** Rating from a number or numeric string between 0 and 10. Empty values are not odd. */
export function parseRating(value: unknown): RatingRead {
  const raw = readText(value);
  if (raw === null) return { value: null, odd: false };
  const number = Number(raw.replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > 10) return { value: null, odd: true };
  return { value: number, odd: false };
}
