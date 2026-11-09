import type { MediaType, UnlinkedTitle } from '@metrack/domain';
import type { PlainTableSpec } from './PlainTableSpec.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { num, text } from './rowMapping.js';

export const unlinkedTitleTable: PlainTableSpec<UnlinkedTitle> = {
  table: 'unlinked_title',
  toRow(t: Omit<UnlinkedTitle, 'id'>): RowValues {
    return {
      media_type: t.mediaType,
      title: t.title,
      year: t.year,
      source: t.source,
      source_ref: t.sourceRef,
      created_at: t.createdAt,
    };
  },
  fromRow(row: Row): UnlinkedTitle {
    return {
      id: Number(row.id),
      mediaType: String(row.media_type) as MediaType,
      title: String(row.title),
      year: num(row.year),
      source: String(row.source),
      sourceRef: text(row.source_ref),
      createdAt: String(row.created_at),
    };
  },
};
