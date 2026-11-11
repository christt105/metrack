ALTER TABLE user ADD COLUMN content_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE public_render (
  user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  rendered_at INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (user_id, cache_key)
) WITHOUT ROWID;
