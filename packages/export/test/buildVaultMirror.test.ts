import { describe, expect, it } from 'vitest';
import type { ExistingNote, ExportInput, MirrorImages } from '../src/index.js';
import { buildVaultMirror } from '../src/index.js';
import { empty, game, movie, season, series } from './support.js';

const HASH = 'a'.repeat(64);
const REF = `/api/images/${HASH}`;

const images: MirrorImages = {
  propertyValue: (ref, current) =>
    current === 'https://img/same.jpg' ? current : `https://img/${ref.slice(-4)}.jpg`,
  embedPath: () => 'Media Tracker/Files/shot.png',
};

function mirror(data: Partial<ExportInput>, existing: Record<string, ExistingNote> = {}) {
  return buildVaultMirror(
    { ...empty, ...data },
    {
      existing: new Map(Object.entries(existing)),
      images,
      webUrl: 'http://metrack.lan',
    },
  );
}

function note(
  data: Partial<ExportInput>,
  path: string,
  existing: Record<string, ExistingNote> = {},
) {
  const found = mirror(data, existing).find((n) => n.path === path);
  if (!found) throw new Error(`No note ${path}`);
  return found.content;
}

describe('buildVaultMirror', () => {
  it('writes a movie note in the plugin format with a link back to the web app', () => {
    const content = note(
      {
        movies: [
          movie({
            status: 'completed',
            finishedAt: '2026-10-25',
            startedAt: '2026-10-24',
            rating: 5,
            rewatches: ['2026-10-26'],
            cover: REF,
            review: 'Loved it.',
          }),
        ],
      },
      'Movies/Alpha (2020).md',
    );
    expect(content).toBe(
      [
        '---',
        'title: Alpha',
        'type: movie',
        'date: 2026-10-25',
        'started: 2026-10-24',
        'rewatches:',
        '  - 2026-10-26',
        'release_date: 2020-05-06',
        'status: Acabado',
        'cover: https://img/aaaa.jpg',
        'banner:',
        'rating: "5"',
        'genres:',
        '  - Drama',
        'tmdb_id: 10',
        'tags: []',
        'overview: An overview',
        'metrack: http://metrack.lan/movies/1',
        'category: "[[Películas]]"',
        'related: []',
        '---',
        'Loved it.',
        '',
      ].join('\n'),
    );
  });

  it('keeps the key order, unowned properties, equivalent values and the review as written', () => {
    const existing: ExistingNote = {
      frontmatter: {
        title: 'Alpha',
        related: ['[[Beta]]'],
        cover: 'https://img/same.jpg',
        status: 'Sin Empezar',
        cssclasses: ['wide'],
      },
      body: '\nSee ![[Media Tracker/Files/shot.png|500]] here.\n',
    };
    const content = note(
      { movies: [movie({ cover: REF, review: `See ![shot.png](${REF}) here.` })] },
      'Movies/Alpha (2020).md',
      { 'Movies/Alpha (2020).md': existing },
    );
    const lines = content.split('\n');
    expect(lines.slice(1, 7)).toEqual([
      'title: Alpha',
      'related:',
      '  - "[[Beta]]"',
      'cover: https://img/same.jpg',
      'status: Sin Empezar',
      'cssclasses:',
    ]);
    expect(content).not.toContain('category');
    expect(content.endsWith('---\n\nSee ![[Media Tracker/Files/shot.png|500]] here.\n')).toBe(true);
  });

  it('rewrites a changed review with vault embeds', () => {
    const content = note(
      { movies: [movie({ review: `New ![shot.png](${REF})` })] },
      'Movies/Alpha (2020).md',
      { 'Movies/Alpha (2020).md': { frontmatter: {}, body: 'Old text\n' } },
    );
    expect(content.endsWith('---\nNew ![[Media Tracker/Files/shot.png]]\n')).toBe(true);
  });

  it('puts a lone season on the series note', () => {
    const notes = mirror({
      series: [series()],
      seasons: [season({ slug: null, status: 'in_progress', rating: 6 })],
    });
    expect(notes.map((n) => n.path)).toEqual(['TVs/Show (2019).md']);
    expect(notes[0]?.content).toContain('status: En Curso');
    expect(notes[0]?.content).toContain('rating: "6"');
    expect(notes[0]?.content).toContain('seasons: []');
  });

  it('writes season notes and derives the series status from them', () => {
    const notes = mirror({
      series: [series()],
      seasons: [
        season({ status: 'completed', finishedAt: '2024-01-02', rating: 7 }),
        season({
          id: 2,
          number: 2,
          title: null,
          slug: 'Show - Season 2',
          status: 'completed',
          finishedAt: '2025-03-04',
        }),
        season({ id: 3, number: 3, title: null, slug: null }),
      ],
    });
    expect(notes.map((n) => n.path)).toEqual([
      'Seasons/Show (2019) - Season 3.md',
      'Seasons/Show - Season 1.md',
      'Seasons/Show - Season 2.md',
      'TVs/Show (2019).md',
    ]);
    const show = notes[3]!.content;
    expect(show).toContain('status: Acabado');
    expect(show).toContain('date: 2025-03-04');
    expect(show).toContain(
      'seasons:\n  - "[[Show - Season 1]]"\n  - "[[Show - Season 2]]"\n  - "[[Show (2019) - Season 3]]"',
    );
    const second = notes[2]!.content;
    expect(second).toContain('title: Show - Season 2');
    expect(second).toContain('series: "[[Show (2019)]]"');
    expect(second).toContain('season_number: 2');
  });

  it('keeps season links written with folders and aliases when they point at the same notes', () => {
    const written = [
      '[[Media Tracker/Seasons/Show - Season 1|Show - Season 1]]',
      '[[Show - Season 2]]',
    ];
    const content = note(
      {
        series: [series()],
        seasons: [season(), season({ id: 2, number: 2, slug: 'Show - Season 2' })],
      },
      'TVs/Show (2019).md',
      { 'TVs/Show (2019).md': { frontmatter: { seasons: written }, body: '' } },
    );
    expect(content).toContain('  - "[[Media Tracker/Seasons/Show - Season 1|Show - Season 1]]"');
  });

  it('writes game ids the way the plugin did and quotes ambiguous strings', () => {
    const content = note(
      { videogames: [game({ title: 'Yes', steamAppId: '730', steamGridDbId: 42 })] },
      'Juegos/Game.md',
    );
    expect(content).toContain('title: "Yes"');
    expect(content).toContain('steam_appid: 730');
    expect(content).toContain('steamgriddb_id: 42');
  });
});
