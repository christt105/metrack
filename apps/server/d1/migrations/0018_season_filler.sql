CREATE TABLE season_filler (
  season_id INTEGER PRIMARY KEY REFERENCES season (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  categories TEXT NOT NULL DEFAULT '{}'
);
