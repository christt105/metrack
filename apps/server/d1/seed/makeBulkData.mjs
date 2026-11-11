import process from 'node:process';

const USER_ID = 2;
const BASE = 1000;
const COUNTS = { movies: 80, series: 65, seasons: 90, games: 90, books: 30 };

let state = 0x6d2b79f5;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (p) => random() < p;
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pad = (n) => String(n).padStart(2, '0');
const date = (fromYear, toYear) => `${int(fromYear, toYear)}-${pad(int(1, 12))}-${pad(int(1, 28))}`;
const quote = (value) => (value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`);
const json = (value) => quote(JSON.stringify(value));

const ADJECTIVES = [
  'Silent',
  'Crimson',
  'Hidden',
  'Last',
  'Broken',
  'Golden',
  'Distant',
  'Hollow',
  'Electric',
  'Forgotten',
  'Paper',
  'Midnight',
  'Northern',
  'Iron',
  'Velvet',
];
const NOUNS = [
  'Harbor',
  'Orchard',
  'Signal',
  'Garden',
  'Empire',
  'Compass',
  'Lantern',
  'Station',
  'Kingdom',
  'Archive',
  'Mirror',
  'Bridge',
  'Valley',
  'Circus',
  'Engine',
];
const GENRES = [
  'Drama',
  'Comedy',
  'Thriller',
  'Sci-Fi',
  'Fantasy',
  'Action',
  'Horror',
  'Romance',
  'Documentary',
  'Animation',
  'Adventure',
  'Puzzle',
  'Strategy',
  'Essay',
  'Mystery',
];
const TAGS = [
  'favorite',
  'rewatch',
  'with-friends',
  'weekend',
  'classic',
  'comfort',
  'long-haul',
  'recommended',
];
const PLATFORMS = ['PC', 'Switch', 'PlayStation 5', 'Steam Deck', 'Xbox Series X'];
const STATUSES = [
  'completed',
  'completed',
  'completed',
  'in_progress',
  'planned',
  'paused',
  'dropped',
];
const WORDS =
  'a made-up story about people who find an unexpected path through a quiet town while the weather keeps changing and old promises come due'.split(
    ' ',
  );

const sentence = (length) => {
  const words = Array.from({ length }, () => pick(WORDS));
  return `${words.join(' ')}.`.replace(/^./, (c) => c.toUpperCase());
};
const paragraph = () =>
  `${sentence(int(14, 22))} ${sentence(int(12, 20))} ${sentence(int(10, 18))}`;
const used = new Set();
function title(kind) {
  for (;;) {
    const value = `${pick(ADJECTIVES)} ${pick(NOUNS)}${chance(0.25) ? ` ${int(2, 5)}` : ''}`;
    if (!used.has(`${kind}:${value}`)) {
      used.add(`${kind}:${value}`);
      return value;
    }
  }
}
const slugOf = (value) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
const genres = () => [...new Set([pick(GENRES), pick(GENRES), pick(GENRES)].slice(0, int(1, 3)))];
const tags = () => (chance(0.4) ? [...new Set([pick(TAGS), pick(TAGS)])] : []);
const image = (kind, id, shape) => `https://images.example.org/${kind}/${shape}/${id}.jpg`;

function tracking() {
  const status = pick(STATUSES);
  const rated = chance(0.5);
  const finished = status === 'completed' ? date(2020, 2026) : null;
  const started = finished && chance(0.6) ? date(2020, 2026) : null;
  const rewatches = finished && chance(0.2) ? [date(2024, 2026), date(2025, 2026)].sort() : [];
  return {
    status,
    started,
    finished,
    rating: rated ? int(2, 20) / 2 : null,
    review: rated && chance(0.6) ? paragraph() : null,
    rewatches,
    tags: tags(),
  };
}

const out = [];
const sql = (text) => out.push(`${text};`);

sql(
  `INSERT INTO user (id, name, email, created_at, role, handle) VALUES (${USER_ID}, 'Bulk Owner', NULL, '2026-01-01T00:00:00.000Z', 'trusted', 'bulk')`,
);
sql(
  `INSERT INTO user_setting (user_id, public_page, public_intro, public_description, public_about) VALUES (${USER_ID}, 1, 'Synthetic library of made-up titles.', ${quote(paragraph())}, ${quote(`${paragraph()}\n\n${paragraph()}`)})`,
);

function entryColumns() {
  return `status, started_at, finished_at, rating, review, rewatches, tags`;
}
function entryValues(t) {
  return [
    quote(t.status),
    quote(t.started),
    quote(t.finished),
    t.rating ?? 'NULL',
    quote(t.review),
    json(t.rewatches),
    json(t.tags),
  ].join(', ');
}

for (let i = 0; i < COUNTS.movies; i++) {
  const id = BASE + i;
  const name = title('movie');
  const t = tracking();
  sql(
    `INSERT INTO movie (id, title, original_title, release_date, overview, genres, cast_members, director, cover, banner, owner_id) VALUES (${id}, ${quote(name)}, ${quote(name)}, ${quote(date(1980, 2026))}, ${quote(paragraph())}, ${json(genres())}, ${json(['A. Actor', 'B. Performer', 'C. Player'])}, ${quote('D. Director')}, ${quote(image('movie', id, 'poster'))}, ${quote(chance(0.7) ? image('movie', id, 'backdrop') : null)}, ${USER_ID})`,
  );
  sql(
    `INSERT INTO movie_entry (user_id, movie_id, slug, ${entryColumns()}) VALUES (${USER_ID}, ${id}, ${quote(slugOf(name))}, ${entryValues(t)})`,
  );
}

let seasonId = BASE;
const extra = new Set();
while (extra.size < COUNTS.seasons - COUNTS.series) extra.add(int(0, COUNTS.series - 1));
const extraList = [...extra];
for (let i = 0; i < COUNTS.series; i++) {
  const id = BASE + i;
  const name = title('series');
  sql(
    `INSERT INTO series (id, title, original_title, first_air_date, overview, genres, cast_members, cover, banner, owner_id) VALUES (${id}, ${quote(name)}, ${quote(name)}, ${quote(date(1995, 2025))}, ${quote(paragraph())}, ${json(genres())}, ${json(['A. Actor', 'B. Performer'])}, ${quote(image('series', id, 'poster'))}, ${quote(chance(0.7) ? image('series', id, 'backdrop') : null)}, ${USER_ID})`,
  );
  sql(
    `INSERT INTO series_entry (user_id, series_id, slug, review, tags) VALUES (${USER_ID}, ${id}, ${quote(slugOf(name))}, ${quote(chance(0.3) ? paragraph() : null)}, ${json(tags())})`,
  );
  const seasons = extraList.includes(i) ? int(2, 3) : 1;
  for (let n = 1; n <= seasons; n++) {
    const t = tracking();
    sql(
      `INSERT INTO season (id, series_id, number, title, overview, first_air_date, episode_count, cover) VALUES (${seasonId}, ${id}, ${n}, ${quote(`Season ${n}`)}, ${quote(paragraph())}, ${quote(date(1995, 2025))}, ${int(6, 24)}, ${quote(image('season', seasonId, 'poster'))})`,
    );
    sql(
      `INSERT INTO season_entry (user_id, season_id, slug, ${entryColumns()}) VALUES (${USER_ID}, ${seasonId}, ${quote(`${slugOf(name)}-s${n}`)}, ${entryValues(t)})`,
    );
    seasonId++;
  }
}

for (let i = 0; i < COUNTS.games; i++) {
  const id = BASE + i;
  const name = title('game');
  const t = tracking();
  sql(
    `INSERT INTO videogame (id, title, release_date, overview, genres, developer, platforms, cover, banner, owner_id) VALUES (${id}, ${quote(name)}, ${quote(date(2000, 2026))}, ${quote(paragraph())}, ${json(genres())}, ${quote('Nobody Studio')}, ${json([pick(PLATFORMS), pick(PLATFORMS)])}, ${quote(image('game', id, 'cover'))}, ${quote(chance(0.7) ? image('game', id, 'hero') : null)}, ${USER_ID})`,
  );
  sql(
    `INSERT INTO videogame_entry (user_id, videogame_id, slug, ${entryColumns()}) VALUES (${USER_ID}, ${id}, ${quote(slugOf(name))}, ${entryValues(t)})`,
  );
}

for (let i = 0; i < COUNTS.books; i++) {
  const id = BASE + i;
  const name = title('book');
  const t = tracking();
  sql(
    `INSERT INTO book (id, title, authors, publisher, page_count, release_date, overview, genres, cover, owner_id) VALUES (${id}, ${quote(name)}, ${json(['E. Author'])}, 'Made-up Press', ${int(120, 700)}, ${quote(date(1960, 2025))}, ${quote(paragraph())}, ${json(genres())}, ${quote(image('book', id, 'cover'))}, ${USER_ID})`,
  );
  sql(
    `INSERT INTO book_entry (user_id, book_id, slug, ${entryColumns()}) VALUES (${USER_ID}, ${id}, ${quote(slugOf(name))}, ${entryValues(t)})`,
  );
}

process.stdout.write(`${out.join('\n')}\n`);
