import { describe, expect, it } from 'vitest';
import {
  buildLibrary,
  renderDetail,
  renderFeed,
  renderHome,
  renderNotFound,
} from '../src/index.js';
import { HASH_A, book, game, input, movie, season, series } from './support.js';

const library = buildLibrary(
  input({
    movies: [
      movie({
        id: 1,
        title: 'Dune <2>',
        status: 'completed',
        finishedAt: '2026-03-05',
        rewatches: ['2026-06-01'],
        rating: 7,
        review: 'Una **obra**.\n\n![foto](/api/images/' + HASH_A + ')',
        cover: 'https://image.tmdb.org/t/p/original/dune.jpg',
        tmdbId: 438631,
      }),
      movie({
        id: 2,
        title: 'Secreta',
        status: 'completed',
        finishedAt: '2026-04-01',
        pendingReview: true,
        review: 'no',
      }),
      movie({ id: 3, title: 'Vieja', status: 'completed' }),
      movie({ id: 4, title: 'Pausada', status: 'paused' }),
    ],
    series: [series({ id: 1, title: 'Lupin', review: 'Sobre la serie' })],
    seasons: [
      season({ id: 1, seriesId: 1, number: 1, status: 'completed', finishedAt: '2026-01-10' }),
      season({ id: 2, seriesId: 1, number: 2, status: 'in_progress' }),
    ],
    videogames: [
      game({
        id: 1,
        title: 'Celeste',
        status: 'in_progress',
        developer: 'Maddy',
        platforms: ['PC'],
      }),
    ],
    books: [
      book({
        id: 1,
        title: 'Neuromante',
        authors: ['William Gibson'],
        status: 'completed',
        finishedAt: '2025-12-24',
      }),
    ],
  }),
);

describe('renderHome', () => {
  const html = renderHome(library);

  it('asks search engines to stay away', () => {
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it('lists each type with its statuses', () => {
    expect(html).toContain('Películas (3)');
    expect(html).toContain('Series (2)');
    expect(html).toContain('Juegos (1)');
    expect(html).toContain('Libros (1)');
    expect(html).toContain('En curso (1)');
    expect(html).toContain('Pausados, abandonados y sin empezar');
    expect(html).toContain('No recuerdo cuándo');
  });

  it('escapes titles, links items by id and counts a rewatch as its own card', () => {
    expect(html).toContain('Dune &lt;2&gt;');
    expect(html).not.toContain('Dune <2>');
    expect(html).toContain('href="/u/ana/movie/1"');
    expect(html.match(/href="\/u\/ana\/movie\/1"/g)?.length).toBe(4);
    expect(html).toContain('/t/p/w342/dune.jpg');
  });

  it('never shows an item pending review', () => {
    expect(html).not.toContain('Secreta');
    expect(html).not.toContain('/movie/2"');
  });

  it('says so when the library is empty', () => {
    expect(renderHome(buildLibrary(input()))).toContain('Todavía no hay nada.');
  });
});

describe('renderDetail', () => {
  it('shows a movie with its review, rating and external link', () => {
    const html = renderDetail(library, 'movie', 1) as string;
    expect(html).toContain('<strong>obra</strong>');
    expect(html).toContain(`/u/ana/images/${HASH_A}`);
    expect(html).toContain('7 · Obra Maestra');
    expect(html).toContain('https://www.themoviedb.org/movie/438631');
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it('shows a series with its seasons and a season with its series', () => {
    const page = renderDetail(library, 'series', 1) as string;
    expect(page).toContain('href="/u/ana/season/1"');
    expect(page).toContain('href="/u/ana/season/2"');
    expect(page).toContain('Sobre la serie');
    expect(renderDetail(library, 'season', 1)).toContain('href="/u/ana/series/1"');
  });

  it('shows game and book fields', () => {
    expect(renderDetail(library, 'videogame', 1)).toContain('Maddy');
    expect(renderDetail(library, 'book', 1)).toContain('William Gibson');
  });

  it('has no page for pending or unknown items', () => {
    expect(renderDetail(library, 'movie', 2)).toBeNull();
    expect(renderDetail(library, 'movie', 99)).toBeNull();
    expect(renderDetail(library, 'season', 99)).toBeNull();
  });
});

describe('renderFeed', () => {
  const feed = renderFeed(library, 'https://example.org');

  it('lists finished items newest first with absolute links', () => {
    const titles = [...feed.matchAll(/<item>\s*<title>(.*?)<\/title>/g)].map((match) => match[1]);
    expect(titles).toEqual(['Dune &lt;2&gt;', 'Lupin - Temporada 1', 'Neuromante']);
    expect(feed).toContain('<link>https://example.org/u/ana/movie/1</link>');
  });

  it('builds the guid from the item and its finish date, not the domain', () => {
    expect(feed).toContain('<guid isPermaLink="false">metrack:ana:movie:1:2026-03-05</guid>');
    expect(renderFeed(library, 'https://other.example')).toContain(
      '<guid isPermaLink="false">metrack:ana:movie:1:2026-03-05</guid>',
    );
  });

  it('includes the confirmed review and leaves out pending items and unfinished ones', () => {
    expect(feed).toContain('&lt;strong&gt;obra&lt;/strong&gt;');
    expect(feed).toContain('https://example.org/u/ana/images/' + HASH_A);
    expect(feed).not.toContain('Secreta');
    expect(feed).not.toContain('Pausada');
    expect(feed).not.toContain('Vieja');
    expect(feed).toContain('<pubDate>Thu, 05 Mar 2026 00:00:00 +0000</pubDate>');
  });
});

describe('renderNotFound', () => {
  it('is a noindex page that names nothing', () => {
    const html = renderNotFound();
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('@');
  });
});
