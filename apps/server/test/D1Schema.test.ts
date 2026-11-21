import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MigrationRunner } from '../src/storage/MigrationRunner.js';
import { migrations } from '../src/storage/migrations/index.js';
import { describeSchema } from './support/describeSchema.js';

const schemaSql = readFileSync(
  new URL('../d1/migrations/0001_schema.sql', import.meta.url),
  'utf8',
);

const renderCacheSql = readFileSync(
  new URL('../d1/migrations/0002_public_render_cache.sql', import.meta.url),
  'utf8',
);

function fromMigrations(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  new MigrationRunner(db, migrations).run();
  return db;
}

const connectorScopeSql = readFileSync(
  new URL('../d1/migrations/0003_connector_token_scope.sql', import.meta.url),
  'utf8',
);

const googleLoginSql = readFileSync(
  new URL('../d1/migrations/0004_google_login.sql', import.meta.url),
  'utf8',
);

const invitesSql = readFileSync(
  new URL('../d1/migrations/0005_invites.sql', import.meta.url),
  'utf8',
);

const episodeGroupSql = readFileSync(
  new URL('../d1/migrations/0006_episode_group.sql', import.meta.url),
  'utf8',
);

const nextEpisodeSql = readFileSync(
  new URL('../d1/migrations/0007_next_episode.sql', import.meta.url),
  'utf8',
);

const rewatchViewingsSql = readFileSync(
  new URL('../d1/migrations/0008_rewatch_viewings.sql', import.meta.url),
  'utf8',
);

const seasonEpisodesSql = readFileSync(
  new URL('../d1/migrations/0009_season_episodes.sql', import.meta.url),
  'utf8',
);

const refillSql = readFileSync(
  new URL('../d1/migrations/0010_season_episodes_refill.sql', import.meta.url),
  'utf8',
);

const dropSeasonOverrideSql = readFileSync(
  new URL('../d1/migrations/0011_drop_season_override.sql', import.meta.url),
  'utf8',
);

const unmatchedEpisodesSql = readFileSync(
  new URL('../d1/migrations/0012_unmatched_episodes.sql', import.meta.url),
  'utf8',
);

const dropPublishSettingsSql = readFileSync(
  new URL('../d1/migrations/0013_drop_publish_settings.sql', import.meta.url),
  'utf8',
);

const userLanguageSql = readFileSync(
  new URL('../d1/migrations/0014_user_language.sql', import.meta.url),
  'utf8',
);

const timeSpentSql = readFileSync(
  new URL('../d1/migrations/0015_time_spent.sql', import.meta.url),
  'utf8',
);

const steamIdSql = readFileSync(
  new URL('../d1/migrations/0016_steam_id.sql', import.meta.url),
  'utf8',
);

const artworkPendingSql = readFileSync(
  new URL('../d1/migrations/0017_artwork_pending.sql', import.meta.url),
  'utf8',
);

const seasonFillerSql = readFileSync(
  new URL('../d1/migrations/0018_season_filler.sql', import.meta.url),
  'utf8',
);

const steamAchievementsSql = readFileSync(
  new URL('../d1/migrations/0019_steam_achievements.sql', import.meta.url),
  'utf8',
);

function fromSql(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(schemaSql);
  db.exec(connectorScopeSql);
  db.exec(googleLoginSql);
  db.exec(invitesSql);
  db.exec(episodeGroupSql);
  db.exec(nextEpisodeSql);
  db.exec(rewatchViewingsSql);
  db.exec(seasonEpisodesSql);
  db.exec(refillSql);
  db.exec(dropSeasonOverrideSql);
  db.exec(unmatchedEpisodesSql);
  db.exec(dropPublishSettingsSql);
  db.exec(userLanguageSql);
  db.exec(timeSpentSql);
  db.exec(steamIdSql);
  db.exec(artworkPendingSql);
  db.exec(seasonFillerSql);
  db.exec(steamAchievementsSql);
  return db;
}

describe('D1 schema file', () => {
  const expected = describeSchema(fromMigrations(), ['schema_migrations']);
  const actual = describeSchema(fromSql(), []);

  it('has the same tables as the TypeScript migrations', () => {
    expect(Object.keys(actual.tables)).toEqual(Object.keys(expected.tables));
  });

  it('has the same columns, defaults and keys in every table', () => {
    expect(actual.tables).toEqual(expected.tables);
  });

  it('has the same foreign keys', () => {
    expect(actual.foreignKeys).toEqual(expected.foreignKeys);
  });

  it('has the same indexes, including unique and partial ones', () => {
    expect(actual.indexes).toEqual(expected.indexes);
  });

  it('has the same explicit index definitions', () => {
    expect(actual.indexSql).toEqual(expected.indexSql);
  });

  it('has the same CHECK constraints', () => {
    expect(actual.checks).toEqual(expected.checks);
    expect(Object.values(actual.checks).flat()).not.toHaveLength(0);
  });

  it('has no views or triggers', () => {
    expect(actual.other).toEqual(expected.other);
    expect(actual.other).toEqual([]);
  });

  it('has the nullable language column that only accepts es and en', () => {
    for (const db of [fromMigrations(), fromSql()]) {
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec('INSERT INTO user_setting (user_id) VALUES (1)');
      expect(db.prepare('SELECT language FROM user_setting').get()?.language).toBeNull();
      db.exec("UPDATE user_setting SET language = 'es'");
      expect(() => db.exec("UPDATE user_setting SET language = 'fr'")).toThrow();
    }
  });

  it('has the nullable steam_id column that refuses an empty value', () => {
    for (const db of [fromMigrations(), fromSql()]) {
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec('INSERT INTO user_setting (user_id) VALUES (1)');
      expect(db.prepare('SELECT steam_id FROM user_setting').get()?.steam_id).toBeNull();
      db.exec("UPDATE user_setting SET steam_id = '76561198000000000'");
      expect(() => db.exec("UPDATE user_setting SET steam_id = ''")).toThrow();
    }
  });

  it('has the artwork_pending flag that defaults to 0 and only accepts 0 and 1', () => {
    for (const db of [fromMigrations(), fromSql()]) {
      db.exec("INSERT INTO videogame (id, title) VALUES (1, 'G')");
      expect(db.prepare('SELECT artwork_pending AS v FROM videogame').get()?.v).toBe(0);
      db.exec('UPDATE videogame SET artwork_pending = 1');
      expect(() => db.exec('UPDATE videogame SET artwork_pending = 2')).toThrow();
    }
  });

  it('has nullable time and runtime columns that refuse negative minutes', () => {
    for (const db of [fromMigrations(), fromSql()]) {
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec('INSERT INTO videogame_entry (user_id, videogame_id) VALUES (1, 1)');
      db.exec('INSERT INTO book_entry (user_id, book_id) VALUES (1, 1)');
      db.exec("INSERT INTO movie (id, title) VALUES (1, 'M')");
      db.exec("INSERT INTO series (id, title) VALUES (1, 'S')");
      expect(db.prepare('SELECT time_spent_minutes AS v FROM videogame_entry').get()?.v).toBeNull();
      expect(db.prepare('SELECT time_spent_minutes AS v FROM book_entry').get()?.v).toBeNull();
      expect(db.prepare('SELECT runtime AS v FROM movie').get()?.v).toBeNull();
      expect(db.prepare('SELECT episode_runtime AS v FROM series').get()?.v).toBeNull();
      db.exec('UPDATE book_entry SET time_spent_minutes = 0');
      expect(() => db.exec('UPDATE book_entry SET time_spent_minutes = -1')).toThrow();
      expect(() => db.exec('UPDATE videogame_entry SET time_spent_minutes = -1')).toThrow();
      expect(() => db.exec('UPDATE movie SET runtime = -1')).toThrow();
      expect(() => db.exec('UPDATE series SET episode_runtime = -1')).toThrow();
    }
  });

  it('no longer has the publish settings columns', () => {
    for (const db of [fromMigrations(), fromSql()]) {
      const columns = db
        .prepare("SELECT name FROM pragma_table_info('user_setting')")
        .all()
        .map((row) => String(row.name));
      expect(columns).not.toContain('publish_project');
      expect(columns).not.toContain('publish_base_url');
      expect(columns).toContain('mirror_dir');
    }
  });

  it('holds no data', () => {
    const tables = fromSql()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row.name));
    const db = fromSql();
    for (const name of tables) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get(), name).toEqual({ n: 0 });
    }
  });

  it('passes the foreign key check', () => {
    expect(fromSql().prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});

describe('D1 render cache migration', () => {
  it('adds only the content version and the public_render table to the home schema', () => {
    const before = describeSchema(fromSql(), []);
    const db = fromSql();
    db.exec(renderCacheSql);
    const after = describeSchema(db, []);
    expect(Object.keys(after.tables)).toEqual(
      [...Object.keys(before.tables), 'public_render'].sort(),
    );
    const { user: beforeUser, ...otherBefore } = before.tables;
    const { user: afterUser, public_render: cache, ...otherAfter } = after.tables;
    expect(otherAfter).toEqual(otherBefore);
    expect(afterUser).toHaveLength((beforeUser ?? []).length + 1);
    expect(afterUser).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'content_version', notnull: 1, dflt_value: '0' }),
      ]),
    );
    expect(cache).toHaveLength(6);
    expect(after.indexes).toEqual(expect.objectContaining(before.indexes));
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
