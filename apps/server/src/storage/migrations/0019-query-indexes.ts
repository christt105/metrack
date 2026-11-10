import type { Migration } from '../Migration.js';

/**
 * Indexes for the statements the API issues that otherwise read a whole table: the owner of a hand-added
 * catalog row (account erase and the user cascade), the series of a season override (series cascade), the
 * images a catalog row shows (who may see an image, image deletion), the alerts of a user by recency, expired
 * sessions and accounts waiting to be erased. Only adds indexes; no data changes.
 */
export const queryIndexesMigration: Migration = {
  version: 19,
  name: 'query-indexes',
  up: (db) => {
    db.exec('CREATE INDEX book_cover ON book (cover)');
    db.exec('CREATE INDEX book_owner ON book (owner_id) WHERE owner_id IS NOT NULL');
    db.exec('CREATE INDEX movie_banner ON movie (banner)');
    db.exec('CREATE INDEX movie_cover ON movie (cover)');
    db.exec('CREATE INDEX movie_owner ON movie (owner_id) WHERE owner_id IS NOT NULL');
    db.exec(
      'CREATE INDEX release_alert_user_sent ON release_alert (user_id, sent_at DESC, id DESC)',
    );
    db.exec('CREATE INDEX season_banner ON season (banner)');
    db.exec('CREATE INDEX season_cover ON season (cover)');
    db.exec('CREATE INDEX season_override_series ON season_override (series_id)');
    db.exec('CREATE INDEX series_banner ON series (banner)');
    db.exec('CREATE INDEX series_cover ON series (cover)');
    db.exec('CREATE INDEX series_owner ON series (owner_id) WHERE owner_id IS NOT NULL');
    db.exec('CREATE INDEX session_expires ON session (expires_at)');
    db.exec(
      'CREATE INDEX user_deletion ON user (deletion_requested_at) WHERE deletion_requested_at IS NOT NULL',
    );
    db.exec('CREATE INDEX videogame_banner ON videogame (banner)');
    db.exec('CREATE INDEX videogame_cover ON videogame (cover)');
    db.exec('CREATE INDEX videogame_owner ON videogame (owner_id) WHERE owner_id IS NOT NULL');
  },
};
