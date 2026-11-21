ALTER TABLE videogame_entry ADD COLUMN achievements_unlocked INTEGER CHECK (achievements_unlocked IS NULL OR achievements_unlocked >= 0);
ALTER TABLE videogame_entry ADD COLUMN achievements_total INTEGER CHECK (achievements_total IS NULL OR achievements_total >= 0);
ALTER TABLE videogame_entry ADD COLUMN achievements_last_unlocked_at TEXT;
ALTER TABLE videogame_entry ADD COLUMN achievements_checked_at TEXT;
