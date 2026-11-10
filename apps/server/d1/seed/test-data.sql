INSERT INTO user (id, name, email, created_at, role, handle)
VALUES (1, 'Test Owner', NULL, '2026-01-01T00:00:00.000Z', 'owner', 'test');

INSERT INTO user_setting (user_id, public_page, public_intro, public_description)
VALUES (1, 1, 'Sample data for the metrack test Worker.', 'A public page with made-up titles.');

INSERT INTO movie (id, title, original_title, release_date, overview, genres, owner_id)
VALUES (1, 'Sample Movie', 'Sample Movie', '2020-05-01', 'A made-up movie.', '["Drama"]', 1);
INSERT INTO movie_entry (user_id, movie_id, slug, status, rating, review, finished_at)
VALUES (1, 1, 'sample-movie', 'completed', 7.5, 'A made-up review.', '2026-01-02');

INSERT INTO series (id, title, original_title, first_air_date, overview, genres, owner_id)
VALUES (1, 'Sample Series', 'Sample Series', '2021-03-01', 'A made-up series.', '["Comedy"]', 1);
INSERT INTO season (id, series_id, number, title, episode_count)
VALUES (1, 1, 1, 'Season 1', 8);
INSERT INTO series_entry (user_id, series_id, slug) VALUES (1, 1, 'sample-series');
INSERT INTO season_entry (user_id, season_id, slug, status, started_at)
VALUES (1, 1, 'sample-series-s1', 'in_progress', '2026-01-03');

INSERT INTO videogame (id, title, release_date, overview, genres, developer, platforms, owner_id)
VALUES (1, 'Sample Game', '2019-10-10', 'A made-up game.', '["Puzzle"]', 'Nobody Studio', '["PC"]', 1);
INSERT INTO videogame_entry (user_id, videogame_id, slug, status)
VALUES (1, 1, 'sample-game', 'planned');

INSERT INTO book (id, title, authors, overview, genres, owner_id)
VALUES (1, 'Sample Book', '["A. Writer"]', 'A made-up book.', '["Essay"]', 1);
INSERT INTO book_entry (user_id, book_id, slug, status, rating)
VALUES (1, 1, 'sample-book', 'paused', 6);
