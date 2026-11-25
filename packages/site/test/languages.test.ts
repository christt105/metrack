import { describe, expect, it } from 'vitest';
import {
  buildLibrary,
  englishMessages,
  languageFromAcceptLanguage,
  messagesFor,
  renderCollage,
  renderDetail,
  renderHome,
  renderNotFound,
  renderPrivacy,
  renderStats,
  spanishMessages,
} from '../src/index.js';
import { game, input, movie } from './support.js';

const FINISHED = {
  status: 'completed' as const,
  finishedAt: '2026-06-01',
  rating: 7,
  tags: ['cine'],
  genres: ['Animation'],
  rewatches: [{ startedAt: null, finishedAt: '2026-07-04' }],
};

const data = () =>
  input({
    movies: [movie({ id: 1, ...FINISHED }), movie({ id: 2, ...FINISHED, rating: 6 })],
    videogames: [game({ id: 1, status: 'completed', finishedAt: '2026-05-05', platforms: ['PC'] })],
  });

const english = () => buildLibrary(data(), englishMessages);
const spanish = () => buildLibrary(data(), spanishMessages);

const ENGLISH_ONLY = [
  'Non-anime',
  'Cinema',
  'Streaming / Home',
  'Rewatches:',
  'Collage Settings',
  'Download PNG',
  'Items found:',
  'Main Navigation',
  'aria-label="Content"',
];

const SPANISH_ONLY = ['Estadísticas', 'Biblioteca', 'Completado', 'Obra maestra', 'Películas'];

describe('the dictionaries', () => {
  it('have the same shape and no empty text', () => {
    const shape = (value: unknown): unknown =>
      typeof value === 'object' && value !== null
        ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]))
        : typeof value;
    expect(shape(englishMessages)).toEqual(shape(spanishMessages));
    const empty: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string' && value.trim() === '') empty.push(path);
      if (typeof value === 'object' && value !== null) {
        for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
      }
    };
    walk(englishMessages, 'en');
    walk(spanishMessages, 'es');
    expect(empty).toEqual([]);
  });

  it('are picked by language, Spanish when there is none', () => {
    expect(messagesFor('en')).toBe(englishMessages);
    expect(messagesFor('es')).toBe(spanishMessages);
    expect(messagesFor(null)).toBe(spanishMessages);
  });

  it('use no long dash', () => {
    expect(JSON.stringify(englishMessages)).not.toContain('—');
    expect(JSON.stringify(spanishMessages)).not.toContain('—');
    expect(englishMessages.privacy.body('a@b.c', '/x')).not.toContain('—');
    expect(spanishMessages.privacy.body('a@b.c', '/x')).not.toContain('—');
  });
});

describe('the pages of an English owner', () => {
  const pages = (): Record<string, string> => ({
    home: renderHome(english()),
    stats: renderStats(english()),
    collage: renderCollage(english()),
    detail: renderDetail(english(), 'movie', 1) as string,
  });

  it('are written in English with no Spanish text left', () => {
    for (const [name, html] of Object.entries(pages())) {
      expect(html, name).toContain('<html lang="en">');
      for (const text of SPANISH_ONLY) expect(html, `${name} ${text}`).not.toContain(text);
    }
    const { home, stats, collage, detail } = pages();
    expect(home).toContain('Library');
    expect(stats).toContain('Anime content');
    expect(stats).toContain('Non-anime');
    expect(collage).toContain('Collage Settings');
    expect(detail).toContain('Rewatches:');
  });

  it('write dates and numbers the English way', () => {
    const { home, stats, detail } = pages();
    expect(home).toContain('Jun 1, 2026');
    expect(detail).toContain('Jul 4, 2026');
    expect(stats).toContain('6.5');
    expect(stats).not.toContain('6,5');
  });

  it('give the collage script its texts as JSON, not as literals', () => {
    const html = pages().collage as string;
    const match = /<script type="application\/json" id="site-data">(.*?)<\/script>/.exec(html);
    expect(JSON.parse(match?.[1] ?? 'null')).toEqual({
      index: '/u/ana/index.json',
      download: 'Download PNG',
      generating: 'Generating...',
      tooLarge: 'Error: Image is too large for the browser.',
      failed: 'Error :(',
    });
  });
});

describe('the pages of a Spanish owner', () => {
  it('have none of the English texts of the English pages', () => {
    const pages = [
      renderHome(spanish()),
      renderStats(spanish()),
      renderCollage(spanish()),
      renderDetail(spanish(), 'movie', 1) as string,
    ];
    for (const html of pages) {
      expect(html).toContain('<html lang="es">');
      for (const text of ENGLISH_ONLY) expect(html, text).not.toContain(text);
    }
    expect(pages[1]).toContain('No anime');
    expect(pages[1]).toContain('Cine vs. Streaming');
    expect(pages[1]).toContain('6,5');
    expect(pages[2]).toContain('Ajustes del collage');
    expect(pages[3]).toContain('Revisionados:');
    expect(pages[0]).toContain('1 jun 2026');
  });

  it('do not need a language: the default library is Spanish', () => {
    expect(renderHome(buildLibrary(data()))).toContain('<html lang="es">');
  });
});

describe('the site script', () => {
  it('holds no text of its own', async () => {
    const { SITE_JS } = await import('../src/assets/SITE_JS.js');
    for (const text of ['Download', 'Descargar', 'Generating', 'Generando', 'Error']) {
      expect(SITE_JS).not.toContain(`'${text}`);
      expect(SITE_JS).not.toContain(`"${text}`);
    }
  });
});

describe('renderNotFound and renderPrivacy', () => {
  it('follow the dictionary they get', () => {
    expect(renderNotFound(englishMessages)).toContain('<html lang="en">');
    expect(renderNotFound(englishMessages)).toContain('This page does not exist.');
    expect(renderNotFound()).toContain('Esta página no existe.');
  });

  it('is written in Spanish by default, with the same facts as the English page', () => {
    const es = renderPrivacy({ contactEmail: 'a&b@example.com' });
    expect(es).toContain('<html lang="es">');
    expect(es).toContain('<title>Privacidad</title>');
    expect(es).toContain('a&amp;b@example.com');
    expect(es).toContain('la dirección de correo que Google verificó para tu cuenta de Google');
    expect(es).toContain('/api/account/export');
    expect(es).toContain('7 días');
    expect(es).toContain('14 en el segundo disco');
    expect(es).toContain('<em>delete</em>');
    expect(es).toContain(
      'This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
    );
    for (const credit of ['IGDB', 'Twitch', 'Open Library', 'SteamGridDB', 'Steam', 'TheTVDB']) {
      expect(es).toContain(credit);
    }
    const tags = (html: string): string[] =>
      [...html.matchAll(/<(h\d|li|ul|p)[ >]/g)].map((match) => match[1] as string);
    expect(tags(es)).toEqual(
      tags(renderPrivacy({ contactEmail: 'a&b@example.com' }, englishMessages)),
    );
  });
});

describe('languageFromAcceptLanguage', () => {
  it.each([
    [undefined, 'es'],
    [null, 'es'],
    ['', 'es'],
    ['fr-FR,de;q=0.8', 'es'],
    ['en-US,en;q=0.9', 'en'],
    ['es-ES,es;q=0.9,en;q=0.8', 'es'],
    ['en;q=0.5, es;q=0.9', 'es'],
    ['fr, en;q=0.4', 'en'],
    ['EN-gb', 'en'],
    ['en;q=0, es;q=0', 'es'],
    ['en;q=abc', 'es'],
    ['*', 'es'],
  ])('reads %j as %s', (header, expected) => {
    expect(languageFromAcceptLanguage(header)).toBe(expected);
  });
});
