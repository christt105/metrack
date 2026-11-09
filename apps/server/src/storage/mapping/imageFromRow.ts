import { imageRef } from '../../images/imageRef.js';
import type { StoredImage } from '../../images/StoredImage.js';
import type { Row } from './Row.js';

export function imageFromRow(row: Row): StoredImage {
  const hash = String(row.hash);
  return {
    hash,
    ref: imageRef(hash),
    extension: String(row.extension),
    mimeType: String(row.mime_type),
    width: Number(row.width),
    height: Number(row.height),
    byteSize: Number(row.byte_size),
    sourceUrl: row.source_url === null ? null : String(row.source_url),
    createdAt: String(row.created_at),
  };
}
