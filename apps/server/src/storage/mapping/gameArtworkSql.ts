const PENDING = 'artwork_pending = 1';
const OF_USER = 'id IN (SELECT videogame_id FROM videogame_entry WHERE user_id = ?)';

export const MARK_ARTWORK_PENDING_SQL = 'UPDATE videogame SET artwork_pending = 1 WHERE id = ?';

export const LIST_PENDING_ARTWORK_SQL = `SELECT id, igdb_id, steam_appid, cover, banner FROM videogame WHERE ${PENDING} ORDER BY id LIMIT ?`;

export const LIST_PENDING_ARTWORK_OF_USER_SQL = `SELECT id, igdb_id, steam_appid, cover, banner FROM videogame WHERE ${PENDING} AND ${OF_USER} ORDER BY id LIMIT ?`;

export const COUNT_PENDING_ARTWORK_SQL = `SELECT COUNT(*) AS n FROM videogame WHERE ${PENDING}`;

export const COUNT_PENDING_ARTWORK_OF_USER_SQL = `SELECT COUNT(*) AS n FROM videogame WHERE ${PENDING} AND ${OF_USER}`;

export const COMPLETE_ARTWORK_SQL =
  'UPDATE videogame SET cover = ?, banner = ?, steamgriddb_id = ?, artwork_pending = 0 WHERE id = ?';
