import { IMAGE_COLUMNS } from '../../images/imageColumns.js';
import { imageRef } from '../../images/imageRef.js';
import { REVIEW_TABLES } from '../mapping/imageSql.js';

/**
 * Selects the hashes of images nothing references, binding the age limit three times (or null three
 * times for no limit). It reads every table that can hold an image reference.
 */
export const ORPHANS_SQL = orphansSql();

function orphansSql(): string {
  const referenced = IMAGE_COLUMNS.flatMap(({ table, column }) => [
    `SELECT ${column} AS ref FROM ${table} WHERE ${column} IS NOT NULL`,
    `SELECT json_extract(overrides, '$.${column}') AS ref FROM ${table}_entry
     WHERE json_extract(overrides, '$.${column}') IS NOT NULL`,
  ]).join(' UNION ');
  const embedded = REVIEW_TABLES.map(
    (table) =>
      `EXISTS (SELECT 1 FROM ${table} WHERE instr(review, '${imageRef('')}' || image.hash) > 0)`,
  ).join(' OR ');
  return `WITH referenced (ref) AS (${referenced})
     SELECT hash FROM image
     WHERE '${imageRef('')}' || hash NOT IN (SELECT ref FROM referenced)
       AND (source_url IS NULL OR source_url NOT IN (SELECT ref FROM referenced))
       AND NOT EXISTS (
         SELECT 1 FROM image_source
         WHERE image_source.hash = image.hash AND url IN (SELECT ref FROM referenced)
       )
       AND NOT (${embedded})
       AND (? IS NULL OR (
         image.created_at < ?
         AND NOT EXISTS (
           SELECT 1 FROM image_owner WHERE image_owner.hash = image.hash AND image_owner.created_at >= ?
         )
       ))
     ORDER BY hash`;
}
