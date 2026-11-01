import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FetchFn } from '../src/http/FetchFn.js';
import { ImageStore } from '../src/images/ImageStore.js';
import { OpenLibraryClient } from '../src/providers/openlibrary/OpenLibraryClient.js';
import type { OpenLibraryWork } from '../src/providers/openlibrary/OpenLibraryWork.js';
import type { OpenLibraryWorkRecord } from '../src/providers/openlibrary/OpenLibraryWorkRecord.js';
import { BookRepository } from '../src/storage/repositories/index.js';
import { OpenLibraryBookProvider } from '../src/titles/OpenLibraryBookProvider.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';

const COVERS = 'https://covers.openlibrary.org/b/id';

const wind: OpenLibraryWork = {
  key: '/works/OL8479867W',
  title: 'The Name of the Wind',
  author_name: ['Patrick Rothfuss'],
  first_publish_year: 2007,
  cover_i: 11480483,
  number_of_pages_median: 736,
  subject: [
    'Fantasy',
    'Fiction, fantasy, epic',
    'Magic',
    'Kvothe (Fictitious character)',
    'quests',
  ],
  editions: {
    docs: [
      {
        key: '/books/OL35632564M',
        title: 'El nombre del viento',
        cover_i: 15264593,
        language: ['spa'],
        publisher: ['Plaza & Janés'],
        isbn: ['950644174X', '9789506441746'],
      },
    ],
  },
};

const windRecord: OpenLibraryWorkRecord = {
  description: { value: 'Told in  Kvothe’s own voice.\r\n\r\n----------\r\nContains: [1]' },
  first_publish_date: 'March 27, 2007',
};

function openLibraryFetch(options: {
  works: OpenLibraryWork[];
  record?: OpenLibraryWorkRecord | null;
  files?: Record<string, Buffer>;
}) {
  const urls: URL[] = [];
  const fetchFn = ((input: string | URL) => {
    const url = new URL(input.toString());
    urls.push(url);
    if (url.origin === 'https://openlibrary.org' && url.pathname === '/search.json') {
      const q = url.searchParams.get('q') ?? '';
      const key = /^key:(\/works\/\w+)$/.exec(q)?.[1];
      const docs = key ? options.works.filter((w) => w.key === key) : options.works;
      return Promise.resolve(Response.json({ docs }));
    }
    if (url.origin === 'https://openlibrary.org' && url.pathname.startsWith('/works/')) {
      return Promise.resolve(
        options.record === null
          ? new Response('down', { status: 503 })
          : Response.json(options.record ?? {}),
      );
    }
    const file = options.files?.[url.toString()];
    return Promise.resolve(
      file ? new Response(new Uint8Array(file)) : new Response('missing', { status: 404 }),
    );
  }) as FetchFn;
  return { fetchFn, urls };
}

function setup(fetchFn: FetchFn) {
  const db = openTestDatabase();
  const books = new BookRepository(db);
  const images = new ImageStore(db, mkdtempSync(join(tmpdir(), 'metrack-openlibrary-')), fetchFn);
  const client = new OpenLibraryClient(fetchFn, 'es');
  return { books, provider: new OpenLibraryBookProvider(client, books, images) };
}

describe('OpenLibraryClient', () => {
  it('searches in the configured language and filters by first publish year', async () => {
    const { fetchFn, urls } = openLibraryFetch({ works: [wind] });
    const client = new OpenLibraryClient(fetchFn, 'es');
    await client.search('el nombre del viento', 2007);
    await client.search('el nombre del viento', null);
    const [first, second] = urls;
    expect(first?.searchParams.get('q')).toBe('el nombre del viento first_publish_year:2007');
    expect(first?.searchParams.get('lang')).toBe('es');
    expect(first?.searchParams.get('fields')).toContain('editions.title');
    expect(second?.searchParams.get('q')).toBe('el nombre del viento');
  });
});

describe('OpenLibraryBookProvider', () => {
  it('maps search results to the localized edition and flags books already in the tracker', async () => {
    const { fetchFn } = openLibraryFetch({ works: [wind], record: windRecord });
    const t = setup(fetchFn);
    const before = await t.provider.search('nombre del viento', null);
    expect(before[0]).toEqual({
      type: 'book',
      provider: 'openlibrary',
      externalId: 'OL8479867W',
      title: 'El nombre del viento',
      originalTitle: 'The Name of the Wind',
      year: 2007,
      overview: 'Patrick Rothfuss',
      posterUrl: `${COVERS}/15264593-M.jpg?default=false`,
      existingId: null,
    });
    const ref = await t.provider.add('OL8479867W');
    expect((await t.provider.search('nombre del viento', null))[0]?.existingId).toBe(ref.id);
  });

  it('adds a book with the edition title, cover and ISBN and the work metadata', async () => {
    const { fetchFn } = openLibraryFetch({
      works: [wind],
      record: windRecord,
      files: { [`${COVERS}/15264593-L.jpg?default=false`]: png(400, 600, 1) },
    });
    const t = setup(fetchFn);
    const ref = await t.provider.add('OL8479867W');
    expect(ref.type).toBe('book');
    const book = t.books.get(ref.id);
    expect(book).toMatchObject({
      openLibraryId: 'OL8479867W',
      isbn: '9789506441746',
      title: 'El nombre del viento',
      authors: ['Patrick Rothfuss'],
      publisher: 'Plaza & Janés',
      pageCount: 736,
      releaseDate: '2007-03-27',
      overview: 'Told in Kvothe’s own voice.',
      genres: ['Fantasy', 'Magic', 'quests'],
      status: 'planned',
    });
    expect(book?.cover).toMatch(/^\/api\/images\/[0-9a-f]{64}$/);
  });

  it('falls back to the work title, cover and publish year without an edition or record', async () => {
    const work: OpenLibraryWork = { ...wind, editions: { docs: [] } };
    const { fetchFn } = openLibraryFetch({
      works: [work],
      record: null,
      files: { [`${COVERS}/11480483-L.jpg?default=false`]: png(400, 600, 2) },
    });
    const t = setup(fetchFn);
    const book = t.books.get((await t.provider.add('OL8479867W')).id);
    expect(book).toMatchObject({
      title: 'The Name of the Wind',
      isbn: null,
      publisher: null,
      releaseDate: '2007-01-01',
      overview: null,
    });
    expect(book?.cover).not.toBeNull();
  });

  it('collapses the whitespace Open Library leaves inside titles', async () => {
    const work: OpenLibraryWork = {
      key: '/works/OL17556780W',
      title: 'El Nombre de la Ballena\n            \n                Coleccion',
    };
    const { fetchFn } = openLibraryFetch({ works: [work] });
    const [result] = await setup(fetchFn).provider.search('ballena', null);
    expect(result).toMatchObject({
      title: 'El Nombre de la Ballena Coleccion',
      originalTitle: null,
    });
  });

  it('only takes a publish date that names the day', async () => {
    for (const [date, expected] of [
      ['2007-03-27', '2007-03-27'],
      ['27 March 2007', '2007-03-27'],
      ['March 2007', '2007-01-01'],
      ['2007-03', '2007-01-01'],
      ['2007', '2007-01-01'],
    ]) {
      const { fetchFn } = openLibraryFetch({ works: [wind], record: { first_publish_date: date } });
      const t = setup(fetchFn);
      expect(t.books.get((await t.provider.add('OL8479867W')).id)?.releaseDate).toBe(expected);
    }
  });

  it('refuses a book already added, an unknown id and a malformed id', async () => {
    const { fetchFn } = openLibraryFetch({ works: [wind], record: windRecord });
    const t = setup(fetchFn);
    const ref = await t.provider.add('OL8479867W');
    await expect(t.provider.add('OL8479867W')).rejects.toMatchObject({
      status: 409,
      details: { existingId: ref.id },
    });
    await expect(t.provider.add('OL1W')).rejects.toMatchObject({ status: 404 });
    await expect(t.provider.add('OL35632564M')).rejects.toMatchObject({ status: 400 });
  });
});
