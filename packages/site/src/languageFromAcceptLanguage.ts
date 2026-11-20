import type { Language } from '@metrack/domain';

/**
 * The language a visitor's `Accept-Language` header asks for among the ones the pages exist in: the supported
 * language with the highest quality (the first one listed on a tie). Spanish when the header is absent or asks
 * for neither.
 */
export function languageFromAcceptLanguage(header: string | null | undefined): Language {
  let best: Language = 'es';
  let bestQuality = 0;
  for (const part of (header ?? '').split(',')) {
    const [range = '', ...params] = part.trim().split(';');
    const primary = range.trim().toLowerCase().split('-')[0];
    if (primary !== 'es' && primary !== 'en') continue;
    const given = params
      .map((param) => /^\s*q\s*=(.*)$/i.exec(param)?.[1])
      .find((q) => q !== undefined);
    const quality =
      given === undefined ? 1 : /^\s*\d+(\.\d+)?\s*$/.test(given) ? Number(given) : NaN;
    if (Number.isFinite(quality) && quality > bestQuality) {
      best = primary;
      bestQuality = quality;
    }
  }
  return best;
}
