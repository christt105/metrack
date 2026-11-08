import { describe, expect, it } from 'vitest';
import {
  buildLibrary,
  publishedImageHashes,
  renderAbout,
  renderCollage,
  renderDetail,
  renderHome,
  renderIndex,
  renderStats,
  siteAsset,
} from '../src/index.js';
import { HASH_A, HASH_B, NO_PROFILE, game, input, movie, season, series } from './support.js';

const library = buildLibrary(
  input({
    movies: [
      movie({
        id: 1,
        title: 'Dune',
        status: 'completed',
        finishedAt: '2025-03-05',
        rewatches: ['2026-06-01'],
        rating: 7,
        tags: ['cine'],
        banner: 'https://image.tmdb.org/t/p/original/banner.jpg',
        cover: 'https://image.tmdb.org/t/p/original/dune.jpg',
      }),
      movie({
        id: 2,
        title: 'Secreta',
        status: 'completed',
        finishedAt: '2026-04-01',
        pendingReview: true,
        rating: 1,
      }),
      movie({ id: 3, title: 'Alien', status: 'completed', finishedAt: '2026-02-01', rating: 5 }),
    ],
    series: [series({ id: 1, title: 'Lupin' })],
    seasons: [
      season({
        id: 1,
        seriesId: 1,
        number: 1,
        status: 'completed',
        finishedAt: '2026-01-10',
        banner: 'https://image.tmdb.org/t/p/original/s1.jpg',
      }),
      season({
        id: 2,
        seriesId: 1,
        number: 2,
        status: 'completed',
        finishedAt: '2026-01-11',
        pendingReview: true,
      }),
    ],
    videogames: [
      game({
        id: 1,
        title: 'Celeste',
        status: 'completed',
        finishedAt: '2026-05-05',
        rating: 6,
        platforms: ['PC', 'Switch'],
      }),
    ],
  }),
);

describe('renderIndex', () => {
  const items = JSON.parse(renderIndex(library)) as {
    title: string;
    type: string;
    date: string | null;
    image: string;
    banner: string | null;
  }[];

  it('orders the items by finish date, newest first, undated last', () => {
    expect(items.map((item) => item.title)).toEqual([
      'Celeste',
      'Alien',
      'Lupin - Temporada 1',
      'Dune',
      'Lupin',
    ]);
  });

  it('lists the shown entries with the theme type names and never a pending one', () => {
    expect(items.map((item) => item.title).sort()).toEqual([
      'Alien',
      'Celeste',
      'Dune',
      'Lupin',
      'Lupin - Temporada 1',
    ]);
    expect(items.find((item) => item.title === 'Lupin')?.type).toBe('tv');
    expect(items.find((item) => item.title === 'Dune')?.banner).toContain('/t/p/w1280/banner.jpg');
    expect(items.find((item) => item.title === 'Alien')?.image).toBe(
      '/u/assets/default-poster.webp',
    );
  });
});

describe('renderStats', () => {
  const html = renderStats(library);

  it('counts the shown items and completions, rewatches included', () => {
    expect(html).toContain(
      '<span class="stat-number">5</span><span class="stat-label">Total</span>',
    );
    expect(html).toContain(
      '<span class="stat-number">5</span><span class="stat-label">Acabados</span>',
    );
    expect(html).toContain('<option value="2026">2026</option>');
    expect(html).toContain('data-stats-year="2025" hidden');
    expect(html).toContain('/u/assets/stats.js');
  });

  it('leaves out pending items', () => {
    expect(html).not.toContain('Secreta');
    expect(html).toContain('<span class="stat-number">6,3<span class="stat-max">/ 7</span>');
  });

  it('adds the platform and cinema sections', () => {
    expect(html).toContain('Plataformas de juego');
    expect(html).toContain('Cine vs. Streaming');
    expect(html).toContain('conic-gradient');
  });
});

describe('renderCollage', () => {
  it('carries the controls and loads the collage script against the library index', () => {
    const html = renderCollage(library);
    expect(html).toContain('id="collage-canvas"');
    expect(html).toContain('/u/assets/collage.js');
    expect(html).toContain('data-index="/u/ana/index.json"');
  });
});

describe('renderAbout', () => {
  it('is missing until the user writes the text', () => {
    expect(renderAbout(library)).toBeNull();
  });

  it('renders the Markdown and lights the menu entry', () => {
    const about = buildLibrary(
      input({ profile: { ...NO_PROFILE, about: '## Hola\n\nUn **texto**.' } }),
    );
    const html = renderAbout(about) as string;
    expect(html).toContain('<h2>Hola</h2>');
    expect(html).toContain('<strong>texto</strong>');
    expect(html).toContain('<a class="menu-link active" href="/u/ana/about/">Acerca de</a>');
  });
});

describe('comments', () => {
  it('are off unless giscus is set up', () => {
    expect(renderDetail(library, 'movie', 1)).not.toContain('giscus');
  });

  it('use the giscus values of the user on item pages', () => {
    const withComments = buildLibrary(
      input({
        movies: [movie({ id: 1, title: 'Dune' })],
        profile: {
          ...NO_PROFILE,
          giscus: {
            repo: 'ana/site',
            repoId: 'R_1',
            category: 'Announcements',
            categoryId: 'DIC_1',
          },
        },
      }),
    );
    const html = renderDetail(withComments, 'movie', 1) as string;
    expect(html).toContain('<script src="https://giscus.app/client.js"');
    expect(html).toContain('data-repo="ana/site"');
    expect(html).toContain('data-category-id="DIC_1"');
    expect(html).toContain('data-mapping="pathname"');
  });
});

describe('publishedImageHashes', () => {
  it('includes the avatar and images embedded in the about text', () => {
    const shown = buildLibrary(
      input({
        profile: {
          ...NO_PROFILE,
          avatar: `/api/images/${HASH_A}`,
          about: `![x](/api/images/${HASH_B})`,
        },
      }),
    );
    expect([...publishedImageHashes(shown)].sort()).toEqual([HASH_A, HASH_B]);
  });
});

describe('siteAsset', () => {
  it('serves the theme files and nothing else', () => {
    expect(siteAsset('theme.css')?.contentType).toContain('text/css');
    expect(siteAsset('fonts/Roboto/roboto-v30-latin-regular.woff2')?.body).toBeInstanceOf(
      Uint8Array,
    );
    expect(siteAsset('../secret')).toBeUndefined();
    expect(siteAsset('nope.js')).toBeUndefined();
  });
});

describe('season titles', () => {
  const lib = buildLibrary(
    input({
      series: [series({ id: 1, title: 'Jujutsu Kaisen' }), series({ id: 2, title: 'Fallout' })],
      seasons: [
        season({
          id: 1,
          seriesId: 1,
          number: 3,
          title: 'Temporada 3: Parte 4',
          status: 'completed',
          finishedAt: '2026-05-22',
        }),
        season({
          id: 2,
          seriesId: 2,
          number: 2,
          title: 'Fallout - Temporada 2',
          status: 'completed',
          finishedAt: '2026-05-18',
        }),
        season({
          id: 3,
          seriesId: 2,
          number: 1,
          title: null,
          status: 'completed',
          finishedAt: '2024-05-18',
        }),
      ],
    }),
  );

  it('prefixes the series title unless the season names it already, on cards, index and item page', () => {
    const titles = lib.seasons.map((entry) => entry.title).sort();
    expect(titles).toEqual([
      'Fallout - Temporada 1',
      'Fallout - Temporada 2',
      'Jujutsu Kaisen - Temporada 3: Parte 4',
    ]);
    expect(renderHome(lib)).toContain('Jujutsu Kaisen - Temporada 3: Parte 4');
    expect(renderIndex(lib)).toContain('Jujutsu Kaisen - Temporada 3: Parte 4');
    expect(renderDetail(lib, 'season', 1)).toContain(
      '<title>Jujutsu Kaisen - Temporada 3: Parte 4 |',
    );
  });
});

describe('vendored assets', () => {
  it('serves Font Awesome and html2canvas itself and loads the metrack stylesheet last', () => {
    for (const html of [renderHome(library), renderCollage(library)]) {
      expect(html).not.toMatch(/cdnjs|unpkg/);
      expect(html).toContain('/u/assets/fontawesome.css');
      expect(html.lastIndexOf('/u/assets/metrack.css')).toBeGreaterThan(
        html.lastIndexOf('/u/assets/theme.css'),
      );
    }
    expect(renderCollage(library)).toContain('/u/assets/html2canvas-pro.js');
    expect(siteAsset('fonts/fontawesome/fa-solid-900.woff2')?.contentType).toBe('font/woff2');
    expect(siteAsset('fonts/fontawesome/fa-brands-400.woff2')?.contentType).toBe('font/woff2');
    expect(siteAsset('html2canvas-pro.js')?.contentType).toContain('javascript');
  });

  it('links the footer name to the repository', () => {
    expect(renderHome(library)).toContain(
      '<a href="https://github.com/christt105/metrack" target="_blank" rel="noopener noreferrer">metrack</a>',
    );
  });
});
