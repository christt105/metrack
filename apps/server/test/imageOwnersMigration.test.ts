import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';

const TMDB = 'https://image.tmdb.org/t/p/original/poster.jpg';
const GRID = 'https://cdn2.steamgriddb.com/grid/a.png';
const hash = (n: number) => String(n).repeat(64);
const ref = (n: number) => `/api/images/${hash(n)}`;

describe('the image owners migration', () => {
  it('links copied TMDB art again and gives every own image to the owner', () => {
    const db = new DatabaseSync(':memory:');
    new MigrationRunner(
      db,
      migrations.filter((migration) => migration.version < 15),
    ).run();
    const insert = db.prepare(
      `INSERT INTO image (hash, extension, mime_type, width, height, byte_size, source_url, created_at)
       VALUES (?, 'png', 'image/png', 1, 1, ?, ?, '2026-10-25T00:00:00Z')`,
    );
    insert.run(hash(1), 100, TMDB);
    insert.run(hash(2), 200, GRID);
    insert.run(hash(3), 300, null);
    insert.run(hash(4), 400, 'https://blogger.googleusercontent.com/a.png');
    db.exec(`
      INSERT INTO movie (id, title, cover, banner) VALUES (1, 'Matrix', '${ref(1)}', '${ref(3)}');
      INSERT INTO movie_entry (user_id, movie_id, overrides)
        VALUES (1, 1, '{"cover":"${ref(1)}","banner":"${ref(4)}"}');
      INSERT INTO videogame (id, title, cover) VALUES (1, 'Hades', '${ref(2)}');
    `);
    new MigrationRunner(db, migrations).run();

    expect(db.prepare('SELECT cover, banner FROM movie').get()).toEqual({
      cover: TMDB,
      banner: ref(3),
    });
    expect(
      JSON.parse(String(db.prepare('SELECT overrides FROM movie_entry').get()?.overrides)),
    ).toEqual({
      cover: TMDB,
      banner: ref(4),
    });
    expect(db.prepare('SELECT cover FROM videogame').get()).toEqual({ cover: ref(2) });
    expect(db.prepare('SELECT hash, user_id FROM image_owner ORDER BY hash').all()).toEqual([
      { hash: hash(3), user_id: 1 },
      { hash: hash(4), user_id: 1 },
    ]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM image').get()).toEqual({ n: 4 });
  });
});
