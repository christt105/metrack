import type { DatabaseSync } from 'node:sqlite';
import type { UserScope } from '../../users/UserScope.js';
import type { MediaType, UnlinkedTitle } from '@metrack/domain';
import type { UnlinkedTitleRepository } from '../repositories/UnlinkedTitleRepository.js';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';
import { SqlitePlainTableRepository } from './SqlitePlainTableRepository.js';
import { num, text } from './rowMapping.js';

export class SqliteUnlinkedTitleRepository
  extends SqlitePlainTableRepository<UnlinkedTitle>
  implements UnlinkedTitleRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, 'unlinked_title');
  }

  async findBySourceRef(source: string, sourceRef: string): Promise<UnlinkedTitle | undefined> {
    return this.all('source = ? AND source_ref = ? ORDER BY id LIMIT 1', source, sourceRef)[0];
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
