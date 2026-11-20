import { describe, expect, it } from 'vitest';
import { OpenLibraryImageProvider } from '../src/artwork/OpenLibraryImageProvider.js';
import type { FetchFn } from '../src/http/FetchFn.js';
import { OpenLibraryClient } from '../src/providers/openlibrary/OpenLibraryClient.js';
import { emptyBook, emptyMovie } from '../src/media/emptyEntities.js';
import { pathFetch } from './support/pathFetch.js';

const WORK = 'https://openlibrary.org/works/OL1W.json';
const EDITIONS = 'https://openlibrary.org/works/OL1W/editions.json';
const COVER = 'https://covers.openlibrary.org/b/id';

const book = { type: 'book', entity: { id: 1, ...emptyBook(), openLibraryId: 'OL1W' } } as const;

function provider(fetchFn: FetchFn, language = 'es'): OpenLibraryImageProvider {
  return new OpenLibraryImageProvider(new OpenLibraryClient(fetchFn, language));
}

describe('OpenLibraryImageProvider', () => {
  it('supports only book covers', () => {
    const p = provider(pathFetch({}).fetch);
    expect(p.supports('book', 'cover')).toBe(true);
    expect(p.supports('book', 'banner')).toBe(false);
    expect(p.supports('movie', 'cover')).toBe(false);
  });

  it('offers nothing for a book without an Open Library id', async () => {
    const p = provider(pathFetch({}).fetch);
    const subject = {
      type: 'book',
      entity: { id: 1, ...emptyBook(), openLibraryId: null },
    } as const;
    expect(await p.candidates(subject)).toEqual([]);
    expect(await p.candidates({ type: 'movie', entity: { id: 1, ...emptyMovie() } })).toEqual([]);
  });

  it('puts covers in the configured language first, then the work covers, then the rest', async () => {
    const p = provider(
      pathFetch({
        [WORK]: { covers: [5, -1, 9, 5] },
        [EDITIONS]: {
          entries: [
            { covers: [1, -1], languages: [{ key: '/languages/eng' }] },
            { covers: [2, 9], languages: [{ key: '/languages/spa' }] },
            { covers: [1, 3], languages: [{ key: '/languages/spa' }] },
            { covers: [4], languages: [{ key: '/languages/xxx' }] },
            { languages: [{ key: '/languages/spa' }] },
          ],
        },
      }).fetch,
    );
    const candidates = await p.candidates(book);
    expect(candidates.map((c) => [c.url, c.language])).toEqual([
      [`${COVER}/2-L.jpg?default=false`, 'es'],
      [`${COVER}/9-L.jpg?default=false`, 'es'],
      [`${COVER}/3-L.jpg?default=false`, 'es'],
      [`${COVER}/5-L.jpg?default=false`, null],
      [`${COVER}/1-L.jpg?default=false`, 'en'],
      [`${COVER}/4-L.jpg?default=false`, null],
    ]);
    expect(candidates[0]).toEqual({
      provider: 'openlibrary',
      url: `${COVER}/2-L.jpg?default=false`,
      thumbUrl: `${COVER}/2-M.jpg?default=false`,
      width: null,
      height: null,
      score: null,
      language: 'es',
    });
  });

  it('owns https covers.openlibrary.org urls only', () => {
    const p = provider(pathFetch({}).fetch);
    expect(p.owns(`${COVER}/1-L.jpg`)).toBe(true);
    expect(p.owns('http://covers.openlibrary.org/b/id/1-L.jpg')).toBe(false);
    expect(p.owns('https://openlibrary.org/b/id/1-L.jpg')).toBe(false);
    expect(p.owns('https://covers.openlibrary.org.evil.test/a.jpg')).toBe(false);
    expect(p.owns('nope')).toBe(false);
  });
});
