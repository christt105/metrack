ALTER TABLE user ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX user_google_sub ON user (google_sub);
