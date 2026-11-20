import type { PendingGameArtwork } from '../repositories/PendingGameArtwork.js';
import type { Row } from './Row.js';
import { num, text } from './rowMapping.js';

export function pendingArtworkFromRow(row: Row): PendingGameArtwork {
  return {
    id: Number(row.id),
    igdbId: num(row.igdb_id),
    steamAppId: text(row.steam_appid),
    cover: text(row.cover),
    banner: text(row.banner),
  };
}
