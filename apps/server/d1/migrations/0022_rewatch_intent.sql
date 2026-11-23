ALTER TABLE season_entry ADD COLUMN wants_rewatch INTEGER NOT NULL DEFAULT 0 CHECK (wants_rewatch IN (0,1));
