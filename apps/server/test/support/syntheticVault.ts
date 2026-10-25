import { png } from './sampleImages.js';

export const REMOTE_COVER = 'https://image.example.test/t/p/original/known.jpg';
export const UNKNOWN_REMOTE_COVER = 'https://image.example.test/t/p/original/unknown.jpg';

const note = (frontmatter: string, body = ''): string => `---\n${frontmatter}\n---\n${body}`;

/** A small vault covering every kind of note and every kind of problem the importer reports. */
export function syntheticVault(): Record<string, string | Buffer> {
  return {
    'Películas.md': '![[Media Tracker/Views.base]]',
    'Portadas/Local Cover.png': png(40, 60),
    'Movies/Alpha (2020).md': note(
      [
        'title: Alpha',
        'type: movie',
        'date: 2024-03-05',
        'rewatches:',
        '  - 2025-01-02',
        'release_date: 2020-05-06',
        'status: Acabado',
        `cover: ${REMOTE_COVER}`,
        `banner: ${UNKNOWN_REMOTE_COVER}`,
        'rating: "7"',
        'genres:',
        '  - Drama',
        'tmdb_id: 100',
        'overview: " "',
      ].join('\n'),
      'Great film.\n',
    ),
    'Movies/Beta (2021).md': note(
      [
        'title: Beta',
        'type: movie',
        'date:',
        'status: Acabado',
        'cover: "[[Media Tracker/Portadas/Local Cover.png]]"',
        'banner:',
        'rating:',
        'tmdb_id: 101',
        'mood: happy',
      ].join('\n'),
    ),
    'Movies/Gamma (2022).md': note(
      ['title: Gamma', 'type: movie', 'date: 31/12/2023', 'status: Soon', 'rating: "11"'].join(
        '\n',
      ),
    ),
    'Movies/Alpha Again.md': note(['title: Alpha Again', 'type: movie', 'tmdb_id: 100'].join('\n')),
    'TVs/Delta (2019).md': note(
      [
        'title: Delta',
        'type: tv',
        'date: 2023-02-02',
        'release_date: 2019-01-01',
        'status: Acabado',
        'rating: "6"',
        'tmdb_id: 200',
        'thetvdb_id: 900',
        'seasons: []',
      ].join('\n'),
    ),
    'TVs/Epsilon (2020).md': note(
      [
        'title: Epsilon',
        'type: tv',
        'status: Sin Empezar',
        'tmdb_id: 201',
        'release_date: 2020-02-02',
      ].join('\n'),
    ),
    'TVs/Zeta (2018).md': note(
      ['title: Zeta', 'type: tv', 'status: Acabado', 'date: 2020-01-01', 'tmdb_id: 202'].join('\n'),
    ),
    'TVs/Nameless (2017).md': note(
      ['title: Nameless', 'type: tv', 'release_date: 2017-07-07'].join('\n'),
    ),
    'Seasons/Zeta - Season 1.md': note(
      [
        'title: Zeta - Season 1',
        'type: season',
        'series: "[[Zeta (2018)]]"',
        'season_number: 1',
        'status: Acabado',
        'date: 2019-05-05',
        'rating: 8',
      ].join('\n'),
    ),
    'Seasons/Zeta - Season 3.md': note(
      [
        'title: Zeta - Season 3',
        'type: season',
        'series: "[[Media Tracker/TVs/Zeta (2018)|Zeta]]"',
        'season_number: "3"',
        'status: En Curso',
      ].join('\n'),
    ),
    'Seasons/Zeta - Season 3 again.md': note(
      ['title: Zeta again', 'type: season', 'series: "[[Zeta (2018)]]"', 'season_number: 3'].join(
        '\n',
      ),
    ),
    'Seasons/Lost - Season 1.md': note(
      ['title: Lost S1', 'type: season', 'series: "[[Missing (2000)]]"', 'season_number: 1'].join(
        '\n',
      ),
    ),
    'Seasons/Nameless - Season 1.md': note(
      [
        'title: Nameless S1',
        'type: season',
        'series: "[[Nameless (2017)]]"',
        'season_number: 1',
      ].join('\n'),
    ),
    'Seasons/No Number.md': note(
      ['title: No Number', 'type: season', 'series: "[[Zeta (2018)]]"'].join('\n'),
    ),
    'Juegos/Hollow.md': note(
      [
        'title: Hollow',
        'type: videogame',
        'status: Abandonado',
        'igdb_id: 300',
        'steam_appid: ""',
        'steamgriddb_id: 55',
        'developer: Studio',
        'platforms:',
        '  - PC',
      ].join('\n'),
    ),
    'Juegos/Hollow Demo.md': note(
      ['title: Hollow Demo', 'type: videogame', 'igdb_id: 300'].join('\n'),
    ),
    'Juegos/Steam Only.md': note(
      ['title: Steam Only', 'type: videogame', 'steam_appid: "730"', 'status: Pausado'].join('\n'),
    ),
    'Juegos/Nothing.md': note(
      ['title: Nothing', 'type: videogame', 'release_date: 2010-10-10'].join('\n'),
    ),
    'Books/Book One.md': note(
      [
        'title: Book One',
        'type: book',
        'status: Acabado',
        'date: 2022-02-02',
        'author: Someone',
        'openlibrary_id: OL1W',
        'page_count: 320',
        'publisher: Pub',
      ].join('\n'),
    ),
    'Books/Book Two.md': note(['title: Book Two', 'type: book'].join('\n')),
    'Misc/Broken.md': '---\ntitle: [unclosed\n---\n',
    'Misc/NoType.md': note('title: What'),
  };
}
