import type { DatabaseSync } from 'node:sqlite';
import type { UnlinkedTitle } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { unlinkedTitleTable } from '../mapping/unlinkedTitleTable.js';
import type { UnlinkedTitleRepository } from '../repositories/UnlinkedTitleRepository.js';
import { SqlitePlainTableRepository } from './SqlitePlainTableRepository.js';

export class SqliteUnlinkedTitleRepository
  extends SqlitePlainTableRepository<UnlinkedTitle>
  implements UnlinkedTitleRepository
{
  constructor(db: DatabaseSync, scope: UserScope) {
    super(db, scope, unlinkedTitleTable);
  }

  async findBySourceRef(source: string, sourceRef: string): Promise<UnlinkedTitle | undefined> {
    return this.all('source = ? AND source_ref = ? ORDER BY id LIMIT 1', source, sourceRef)[0];
  }
}
