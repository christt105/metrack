import { describe, expect, it } from 'vitest';
import {
  fillerSlugCandidates,
  isAnimatedGenres,
  matchFillerEpisodes,
  parseFillerList,
  parseFillerSlug,
  slugifyName,
  type Episode,
  type FillerEntry,
} from '../src/index.js';

const row = (cls: string, n: string, title: string) =>
  `<tr class="${cls}" id="eps-${n}"><td class="Number">${n}</td><td class="Title"><a href="/shows/x/y">${title}</a></td><td class="Type"><span>t</span></td><td class="Date">2002-10-03</td> </tr>`;

const PAGE = `<html><table><tbody>
 ${row('manga_canon odd', '1', 'Enter: Naruto Uzumaki!')}
 ${row('manga_canon even', '2', 'My Name is Konohamaru!')}
 ${row('filler odd', '3', 'Naruto&#039;s &amp; Co &quot;Filler&quot;')}
 ${row('mixed_canon/filler even', '4', 'Mixed <em>one</em>')}
 ${row('anime_canon odd', '5', 'Anime only')}
 ${row('something_else even', '6', 'Unknown class')}
 <tr class="filler even"><td class="Title">No number</td></tr>
</tbody></table></html>`;

describe('parseFillerList', () => {
  it('reads the rows of each known class in order and decodes titles', () => {
    expect(parseFillerList(PAGE)).toEqual([
      { number: 1, category: 'mangaCanon', title: 'Enter: Naruto Uzumaki!' },
      { number: 2, category: 'mangaCanon', title: 'My Name is Konohamaru!' },
      { number: 3, category: 'filler', title: 'Naruto\'s & Co "Filler"' },
      { number: 4, category: 'mixed', title: 'Mixed one' },
      { number: 5, category: 'animeCanon', title: 'Anime only' },
    ]);
  });

  it('ignores unknown classes and rows without a number', () => {
    expect(parseFillerList(row('weird', '1', 'x') + '<tr class="filler"><td></td></tr>')).toEqual(
      [],
    );
  });

  it('gives an empty list for a page that is not found', () => {
    expect(parseFillerList('<html><body><h1>Page not found</h1></body></html>')).toEqual([]);
    expect(parseFillerList('')).toEqual([]);
  });
});

describe('slugs', () => {
  it('slugifies names', () => {
    expect(slugifyName('Naruto Shippūden')).toBe('naruto-shippuden');
    expect(slugifyName("  Frieren: Beyond Journey's End! ")).toBe('frieren-beyond-journeys-end');
    expect(slugifyName('鬼滅の刃')).toBe('');
  });

  it('lists the title then the original title without repeats', () => {
    expect(fillerSlugCandidates('Naruto', 'Naruto')).toEqual(['naruto']);
    expect(fillerSlugCandidates('Naruto Shippuden', 'ナルト')).toEqual(['naruto-shippuden']);
    expect(fillerSlugCandidates('Inuyasha', 'Inuyasha: A Feudal Fairy Tale')).toEqual([
      'inuyasha',
      'inuyasha-a-feudal-fairy-tale',
    ]);
  });

  it('accepts a slug or an animefillerlist.com address and nothing else', () => {
    expect(parseFillerSlug('naruto-shippuden')).toBe('naruto-shippuden');
    expect(parseFillerSlug(' Naruto ')).toBe('naruto');
    expect(parseFillerSlug('https://www.animefillerlist.com/shows/inuyasha')).toBe('inuyasha');
    expect(parseFillerSlug('animefillerlist.com/shows/naruto/')).toBe('naruto');
    expect(parseFillerSlug('http://animefillerlist.com/shows/one-piece?x=1#a')).toBe('one-piece');
    expect(parseFillerSlug('https://evil.example/shows/naruto')).toBeNull();
    expect(parseFillerSlug('https://animefillerlist.com.evil.example/shows/naruto')).toBeNull();
    expect(parseFillerSlug('https://user@animefillerlist.com/shows/naruto')).toBeNull();
    expect(parseFillerSlug('https://animefillerlist.com/other/naruto')).toBeNull();
    expect(parseFillerSlug('ftp://animefillerlist.com/shows/naruto')).toBeNull();
    expect(parseFillerSlug('../etc')).toBeNull();
    expect(parseFillerSlug('a b')).toBeNull();
    expect(parseFillerSlug('')).toBeNull();
  });
});

const ep = (number: number, tmdbId: number | null = null): Episode => ({
  number,
  title: `E${number}`,
  airDate: null,
  runtime: null,
  tmdbId,
  overview: null,
  stillPath: null,
});
const entries = (n: number): FillerEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    category: i % 2 === 0 ? 'filler' : 'mangaCanon',
    title: `T${i + 1}`,
  }));

describe('matchFillerEpisodes', () => {
  it('pairs a two-season series by absolute number', () => {
    const seasons = [
      {
        seasonId: 11,
        seasonNumber: 2,
        episodes: Array.from({ length: 26 }, (_, i) => ep(i + 1, 900 + i)),
      },
      { seasonId: 10, seasonNumber: 1, episodes: Array.from({ length: 167 }, (_, i) => ep(i + 1)) },
      { seasonId: 12, seasonNumber: 0, episodes: [ep(1), ep(2)] },
    ];
    const match = matchFillerEpisodes(entries(193), seasons);
    if (!match.ok) throw new Error('expected a match');
    expect(match.episodes).toHaveLength(193);
    expect(match.episodes[0]).toMatchObject({
      seasonId: 10,
      key: 's1e1',
      absoluteNumber: 1,
      category: 'filler',
    });
    expect(match.episodes[166]).toMatchObject({ seasonId: 10, key: 's1e167', absoluteNumber: 167 });
    expect(match.episodes[167]).toMatchObject({
      seasonId: 11,
      key: '900',
      number: 1,
      absoluteNumber: 168,
    });
    expect(match.episodes[192]).toMatchObject({ seasonId: 11, key: '925', absoluteNumber: 193 });
  });

  it('refuses when the totals differ', () => {
    const seasons = [{ seasonId: 1, seasonNumber: 1, episodes: [ep(1), ep(2)] }];
    expect(matchFillerEpisodes(entries(3), seasons)).toEqual({
      ok: false,
      code: 'filler_count_mismatch',
      ours: 2,
      theirs: 3,
    });
  });

  it('refuses a list that does not number its episodes from 1 without gaps', () => {
    const seasons = [{ seasonId: 1, seasonNumber: 1, episodes: [ep(1), ep(2)] }];
    const gap = [entries(2)[0]!, { ...entries(3)[2]! }];
    expect(matchFillerEpisodes(gap, seasons)).toMatchObject({
      ok: false,
      code: 'filler_list_invalid',
    });
  });
});

describe('isAnimatedGenres', () => {
  it('detects animation in either language, ignoring case', () => {
    expect(isAnimatedGenres(['Drama', 'Animation'])).toBe(true);
    expect(isAnimatedGenres(['animación'])).toBe(true);
    expect(isAnimatedGenres(['Anime'])).toBe(true);
    expect(isAnimatedGenres(['Drama', 'Documentary'])).toBe(false);
    expect(isAnimatedGenres([])).toBe(false);
  });
});
