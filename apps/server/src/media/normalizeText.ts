/** Lowercases and strips accents so searches match "Pokemon" with "Pokémon". */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
