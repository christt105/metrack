import { describe, expect, it } from 'vitest';
import { mediaSourceUrl } from '../src/logic/mediaSourceUrl';

describe('mediaSourceUrl', () => {
  it('links movies and series to their separate TMDB paths', () => {
    expect(mediaSourceUrl('movies', { tmdbId: 42 })).toBe('https://www.themoviedb.org/movie/42');
    expect(mediaSourceUrl('series', { tmdbId: 42 })).toBe('https://www.themoviedb.org/tv/42');
    expect(mediaSourceUrl('movies', { tmdbId: null })).toBeNull();
    expect(mediaSourceUrl('series', {})).toBeNull();
  });

  it('uses the series id and provider season number, including season zero', () => {
    const parent = { tmdbId: 42, tmdbEpisodeGroup: null };
    expect(mediaSourceUrl('seasons', { tmdbSeasonNumber: 0 }, parent)).toBe(
      'https://www.themoviedb.org/tv/42/season/0',
    );
    expect(mediaSourceUrl('seasons', { tmdbSeasonNumber: 1 }, null)).toBeNull();
    expect(mediaSourceUrl('seasons', { tmdbSeasonNumber: null }, parent)).toBeNull();
  });

  it('links grouped seasons to the series because group order differs from TMDB numbering', () => {
    expect(
      mediaSourceUrl('seasons', { tmdbSeasonNumber: 3 }, { tmdbId: 42, tmdbEpisodeGroup: 'group' }),
    ).toBe('https://www.themoviedb.org/tv/42');
  });

  it('only links games with a Steam app id', () => {
    expect(mediaSourceUrl('games', { steamAppId: '42' })).toBe(
      'https://store.steampowered.com/app/42',
    );
    expect(mediaSourceUrl('games', { steamAppId: null })).toBeNull();
  });

  it('selects the Open Library path from the last letter of the book id', () => {
    expect(mediaSourceUrl('books', { openLibraryId: 'OL42W' })).toBe(
      'https://openlibrary.org/works/OL42W',
    );
    expect(mediaSourceUrl('books', { openLibraryId: 'OL42M' })).toBe(
      'https://openlibrary.org/books/OL42M',
    );
    expect(mediaSourceUrl('books', { openLibraryId: 'OL42A' })).toBeNull();
    expect(mediaSourceUrl('books', {})).toBeNull();
  });
});
