import { describe, expect, it } from 'vitest';
import {
  FEED_LIMIT,
  englishMessages,
  buildLibrary,
  renderDetail,
  renderFeed,
  renderHome,
  renderNotFound,
  renderPrivacy,
} from '../src/index.js';
import { HASH_A, NO_PROFILE, book, game, input, movie, season, series } from './support.js';

const library = buildLibrary(
  input({
    movies: [
      movie({
        id: 1,
        title: 'Dune <2>',
        status: 'completed',
        finishedAt: '2026-03-05',
        rewatches: [{ startedAt: null, finishedAt: '2026-06-01' }],
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

describe('renderHome filters and empty states', () => {
  it('lists only the statuses, ratings and groups that have items', () => {
    const html = renderHome(
      buildLibrary(
        input({
          movies: [
            movie({ id: 1, title: 'A', status: 'completed', finishedAt: '2026-01-01', rating: 7 }),
            movie({ id: 2, title: 'B', status: 'planned' }),
          ],
        }),
      ),
    );
    expect(html).toContain('data-value="finished">Completado<');
    expect(html).toContain('data-value="not_started">Pendiente<');
    expect(html).not.toContain('data-value="paused"');
    expect(html).not.toContain('data-value="dropped"');
    expect(html).toContain('data-value="7"');
    expect(html).not.toContain('data-value="6"');
    expect(html).not.toContain('data-value="book"');
    expect(html).not.toContain('data-filter-group="platform"');
  });

  it('shows a short message instead of the filter bar when the library is empty', () => {
    const html = renderHome(buildLibrary(input()));
    expect(html).toContain('Esta biblioteca está vacía.');
    expect(html).not.toContain('id="filter-bar"');
    expect(html).not.toContain('Aún no hay elementos completados.');
  });

  it('uses the status names of the app', () => {
    const html = renderHome(library);
    expect(html).toContain('>En pausa<');
    expect(html).not.toContain('Pausado');
    expect(html).not.toContain('Acabado');
  });
});

describe('renderHome', () => {
  const html = renderHome(library);

  it('asks search engines to stay away', () => {
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it('follows the theme: menu, hero banner, profile, filters and the completed years', () => {
    expect(html).toContain('<div class="navbar" role="navigation">');
    expect(html).toContain('<div id="random-hero-banner"></div>');
    expect(html).toContain('class="author-avatar" src="/u/assets/default-avatar.svg"');
    expect(html).toContain('<h2 class="author-name">@ana</h2>');
    expect(html).toContain('id="filter-bar"');
    expect(html).toContain('data-filter-group="platform"');
    expect(html).toContain('href="/u/ana/?type=movie"');
    expect(html).toContain('<h3 class="section-title">En curso (2)</h3>');
    expect(html).toContain('id="completed-section"');
    expect(html).toContain('<a href="#year-2026" class="year-nav-link">2026</a>');
    expect(html).toContain('<a href="#year-unknown" class="year-nav-link">?</a>');
    expect(html).toContain('id="year-unknown"');
    expect(html).toContain('Ver en pausa y abandonados (1)');
    expect(html).toContain('/u/assets/filter.js');
    expect(html).toContain('/u/assets/banner.js');
  });

  it('puts the cards data where the filters read it', () => {
    expect(html).toContain(
      'data-title="dune &lt;2&gt;" data-year="2026" data-type="movie" data-status="finished" data-rating="7"',
    );
    expect(html).toContain('data-platforms="pc"');
    expect(html).toContain('data-type="season"');
  });

  it('escapes titles, links items by id and counts a rewatch as its own card', () => {
    expect(html).toContain('Dune &lt;2&gt;');
    expect(html).not.toContain('Dune <2>');
    expect(html).toContain('href="/u/ana/movie/1"');
    expect(html.match(/<a href="\/u\/ana\/movie\/1"><img/g)?.length).toBe(2);
    expect(html).toContain('/t/p/w342/dune.jpg');
  });

  it('never shows an item pending review', () => {
    expect(html).not.toContain('Secreta');
    expect(html).not.toContain('/movie/2"');
  });

  it('shows the profile the user wrote and hides the about link without an about text', () => {
    const custom = renderHome(
      buildLibrary(
        input({
          profile: {
            ...NO_PROFILE,
            intro: 'Mi sitio',
            description: 'Lo que veo',
            avatar: `/api/images/${HASH_A}`,
          },
        }),
      ),
    );
    expect(custom).toContain('<h2 class="author-name">Mi sitio</h2>');
    expect(custom).toContain('<p class="author-bio">Lo que veo</p>');
    expect(custom).toContain(`src="/u/ana/images/${HASH_A}"`);
    expect(custom).not.toContain('Acerca de');
    expect(html).not.toContain('Acerca de');
  });
});

describe('renderDetail', () => {
  it('shows a movie with its review, rating and external link', () => {
    const html = renderDetail(library, 'movie', 1) as string;
    expect(html).toContain('<strong>obra</strong>');
    expect(html).toContain(`/u/ana/images/${HASH_A}`);
    expect(html).toContain(
      '<div class="media-rating-badge" style="background: #a855f7; color: white">Obra maestra</div>',
    );
    expect(html).toContain('<div class="page-content">');
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

  it('lists the passes of a season that was started over, and nothing otherwise', () => {
    const started = buildLibrary(
      input({
        series: [series({ id: 1, title: 'Lupin' }), series({ id: 2, title: 'Dark' })],
        seasons: [
          season({
            id: 1,
            seriesId: 1,
            number: 1,
            status: 'in_progress',
            abandoned: [
              { startedAt: '2026-01-01', finishedAt: '2026-01-03', restartedOn: '2026-02-01' },
            ],
          }),
          season({ id: 2, seriesId: 2, number: 1, status: 'in_progress' }),
        ],
      }),
    );
    expect(renderDetail(started, 'season', 1)).toContain('Empezada de nuevo:');
    expect(renderDetail(started, 'season', 2)).not.toContain('Empezada de nuevo:');
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
    expect(titles).toEqual([
      'Dune &lt;2&gt;',
      'Dune &lt;2&gt;',
      'Lupin - Temporada 1',
      'Neuromante',
    ]);
    expect(feed).toContain('<link>https://example.org/u/ana/movie/1</link>');
  });

  it('builds the guid from the item and its finish date, not the domain', () => {
    expect(feed).toContain('<guid isPermaLink="false">metrack:ana:movie:1:2026-03-05</guid>');
    expect(renderFeed(library, 'https://other.example')).toContain(
      '<guid isPermaLink="false">metrack:ana:movie:1:2026-03-05</guid>',
    );
  });

  it('gives the finish date and each rewatch their own item and guid', () => {
    const rewatched = buildLibrary(
      input({
        movies: [
          movie({
            id: 1,
            title: 'Dune',
            status: 'completed',
            finishedAt: '2026-03-05',
            rewatches: [
              { startedAt: null, finishedAt: '2026-06-01' },
              { startedAt: null, finishedAt: '2026-09-10' },
            ],
          }),
          movie({ id: 2, title: 'Alien', status: 'completed', finishedAt: '2026-07-01' }),
        ],
      }),
    );
    const out = renderFeed(rewatched, 'https://example.org');
    const guids = [...out.matchAll(/<guid[^>]*>(.*?)<\/guid>/g)].map((match) => match[1]);
    expect(guids).toEqual([
      'metrack:ana:movie:1:2026-09-10',
      'metrack:ana:movie:2:2026-07-01',
      'metrack:ana:movie:1:2026-06-01',
      'metrack:ana:movie:1:2026-03-05',
    ]);
    expect(out).toContain('<pubDate>Thu, 10 Sep 2026 00:00:00 +0000</pubDate>');
    expect(out).toContain('<pubDate>Mon, 01 Jun 2026 00:00:00 +0000</pubDate>');
    expect(out).toContain('<pubDate>Thu, 05 Mar 2026 00:00:00 +0000</pubDate>');
  });

  it('keeps only the newest FEED_LIMIT viewings', () => {
    const many = buildLibrary(
      input({
        movies: [
          movie({
            id: 1,
            title: 'Loop',
            status: 'completed',
            finishedAt: '2020-01-01',
            rewatches: Array.from({ length: FEED_LIMIT + 20 }, (_, i) => {
              const day = new Date(Date.UTC(2021, 0, 1 + i));
              return { startedAt: null, finishedAt: day.toISOString().slice(0, 10) };
            }),
          }),
        ],
      }),
    );
    const out = renderFeed(many, 'https://example.org');
    expect(out.match(/<item>/g)).toHaveLength(FEED_LIMIT);
    expect(out).not.toContain(':2020-01-01<');
    expect(out).toContain(':2021-04-30<');
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

describe('renderPrivacy', () => {
  it('is an English page that escapes the contact and carries the required TMDB wording', () => {
    const page = renderPrivacy({ contactEmail: 'a&b@example.com' }, englishMessages);
    expect(page).toContain('<html lang="en" class="dark">');
    expect(page).toContain('a&amp;b@example.com');
    expect(page).toContain(
      'This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
    );
    expect(page).toContain('src="/u/assets/tmdb-logo.svg"');
    expect(page).not.toContain('https://www.themoviedb.org/assets');
    expect(page).toContain('Served by metrack');
    expect(page).not.toContain('<script');
  });

  it('says the email Google verified is stored for users who joined by invitation', () => {
    const page = renderPrivacy({ contactEmail: 'a@example.com' }, englishMessages);
    expect(page).toContain('the email address Google verified for your Google account is stored');
    expect(page).not.toContain('no sign-ups are created');
  });
});
