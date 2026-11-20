ALTER TABLE user_setting ADD COLUMN language TEXT CHECK (language IN ('es', 'en'));
