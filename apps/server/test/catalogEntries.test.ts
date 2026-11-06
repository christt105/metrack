import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createImageStore } from '../src/images/createImageStore.js';
import { emptyMovie, emptySeason, emptySeries } from '../src/media/emptyEntities.js';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { SqliteMetadataStateRepository } from '../src/storage/sqlite/SqliteMetadataStateRepository.js';
import { SqliteMovieRepository } from '../src/storage/sqlite/SqliteMovieRepository.js';
import { SqliteSeasonRepository } from '../src/storage/sqlite/SqliteSeasonRepository.js';
import { SqliteSeriesRepository } from '../src/storage/sqlite/SqliteSeriesRepository.js';
import { openTestDatabase } from './support/openTestDatabase.js';
import { png } from './support/sampleImages.js';
import { OWNER_SCOPE } from './support/ownerScope.js';

function catalogRow(db: DatabaseSync, table: string, id: number): Record<string, unknown> {
  return { ...db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) };
}

describe('catalog entries migration', () => {
  it('moves tracking and hand edits into entries and keeps every row', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    new MigrationRunner(db, migrations.slice(0, 8)).run();
    db.exec(`
      INSERT INTO series (id, tmdb_id, jellyfin_id, title, follow, note, review, slug, tags)
        VALUES (7, 70, 'jf-s', 'Lupin', 1, 'obsidian://lupin', 'Great show', 'lupin', '["anime"]');
      INSERT INTO season (id, series_id, number, title, cover, status, rating, edited_fields, pending_review)
        VALUES (3, 7, 1, 'Part 1', '/api/images/abc', 'completed', 6, '["cover","title"]', 1);
      INSERT INTO movie (id, tmdb_id, title, genres, status, rewatches, edited_fields)
        VALUES (5, 50, 'Matrix', '["Action"]', 'completed', '["2026-01-01"]', '["genres"]');
    `);

    new MigrationRunner(db, migrations.slice(0, 9)).run();

    expect(catalogRow(db, 'series', 7)).toMatchObject({ tmdb_id: 70, title: 'Lupin' });
    expect(catalogRow(db, 'series', 7)).not.toHaveProperty('follow');
    expect({ ...db.prepare('SELECT * FROM series_entry').get() }).toEqual({
      series_id: 7,
      jellyfin_id: 'jf-s',
      follow: 1,
      note: 'obsidian://lupin',
      slug: 'lupin',
      tags: '["anime"]',
      review: 'Great show',
      overrides: '{}',
    });
    expect(catalogRow(db, 'season', 3)).toMatchObject({ series_id: 7, cover: '/api/images/abc' });
    expect({ ...db.prepare('SELECT * FROM season_entry').get() }).toMatchObject({
      season_id: 3,
      status: 'completed',
      rating: 6,
      pending_review: 1,
      overrides: JSON.stringify({ cover: '/api/images/abc', title: 'Part 1' }),
    });
    expect(
      JSON.parse(String(db.prepare('SELECT overrides FROM movie_entry').get()?.overrides)),
    ).toEqual({ genres: ['Action'] });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(Number(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys)).toBe(1);

    db.exec('DELETE FROM series WHERE id = 7');
    expect(db.prepare('SELECT COUNT(*) AS n FROM season').get()?.n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM season_entry').get()?.n).toBe(0);
  });
});

describe('catalog and personal entry', () => {
  async function movieSetup() {
    const db = openTestDatabase();
    const movies = new SqliteMovieRepository(db, OWNER_SCOPE);
    const movie = await movies.create({
      ...emptyMovie(),
      tmdbId: 1,
      title: 'Provider title',
      overview: 'Provider plot',
    });
    return { db, movies, states: new SqliteMetadataStateRepository(db, OWNER_SCOPE), id: movie.id };
  }

  it('keeps hand edits out of the catalog, shows them over it and updates them in place', async () => {
    const { db, movies, states, id } = await movieSetup();
    await movies.override(id, { title: 'My title' });
    await movies.update(id, { title: 'Second title', overview: 'Refreshed plot', rating: 7 });

    expect(await movies.get(id)).toMatchObject({
      title: 'Second title',
      overview: 'Refreshed plot',
      rating: 7,
    });
    expect(catalogRow(db, 'movie', id)).toMatchObject({
      title: 'Provider title',
      overview: 'Refreshed plot',
    });
    expect((await states.get('movie', id)).editedFields).toEqual(['title']);
  });

  it('shows the catalog value again when a hand edit is dropped', async () => {
    const { movies, id } = await movieSetup();
    await movies.override(id, { title: 'My title' });
    await movies.clearOverride(id, 'title');
    expect((await movies.get(id))?.title).toBe('Provider title');
    expect(await movies.overriddenFields(id)).toEqual([]);
  });

  it('finds titles by their personal Jellyfin link and their followed flag', async () => {
    const db = openTestDatabase();
    const series = new SqliteSeriesRepository(db, OWNER_SCOPE);
    const seasons = new SqliteSeasonRepository(db, OWNER_SCOPE);
    const s = await series.create({ ...emptySeries(), title: 'Lupin', follow: true });
    await seasons.create({ ...emptySeason(), seriesId: s.id, number: 2, jellyfinId: 'jf-2' });
    await seasons.create({ ...emptySeason(), seriesId: s.id, number: 1 });
    expect((await series.listFollowed()).map((x) => x.id)).toEqual([s.id]);
    expect((await seasons.listBySeries(s.id)).map((x) => x.number)).toEqual([1, 2]);
  });

  it('leaves no catalog row behind when the entry cannot be written', async () => {
    const { db, movies } = await movieSetup();
    await movies.update(1, { jellyfinId: 'jf-1' });
    await expect(
      movies.create({ ...emptyMovie(), tmdbId: 2, title: 'Clash', jellyfinId: 'jf-1' }),
    ).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM movie').get()?.n).toBe(1);
  });

  it('counts an overridden cover as a reference and clears it when the image goes', async () => {
    const { db, movies, id } = await movieSetup();
    const store = createImageStore(db, join(mkdtempSync(join(tmpdir(), 'metrack-entries-')), 'i'));
    const image = await store.add(png(4, 6), null);
    await movies.override(id, { cover: image.ref });
    expect(await store.orphans()).toEqual([]);

    await store.delete(image.hash);
    expect((await movies.get(id))?.cover).toBeNull();
    expect(await movies.overriddenFields(id)).toEqual(['cover']);
  });
});
