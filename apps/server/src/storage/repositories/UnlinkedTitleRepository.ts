import type { DatabaseSync } from 'node:sqlite';
import type { MediaType, UnlinkedTitle } from '@metrack/domain';
import { TableRepository, type Row, type RowValues } from './TableRepository.js';
import { num, text } from './rowMapping.js';

/** Inbox of titles with no external id. Resolving one means deleting it after creating the real entity. */
export class UnlinkedTitleRepository extends TableRepository<UnlinkedTitle> {
  constructor(db: DatabaseSync) {
    super(db, 'unlinked_title');
  }

  findBySourceRef(source: string, sourceRef: string): UnlinkedTitle | undefined {
    return this.list().find((t) => t.source === source && t.sourceRef === sourceRef);
  }

  protected toRow(t: Omit<UnlinkedTitle, 'id'>): RowValues {
    return {
      media_type: t.mediaType,
      title: t.title,
      year: t.year,
      source: t.source,
      source_ref: t.sourceRef,
      created_at: t.createdAt,
    };
  }

  protected fromRow(row: Row): UnlinkedTitle {
    return {
      id: Number(row.id),
      mediaType: String(row.media_type) as MediaType,
      title: String(row.title),
      year: num(row.year),
      source: String(row.source),
      sourceRef: text(row.source_ref),
      createdAt: String(row.created_at),
    };
  }
}
