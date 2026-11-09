import type { UnlinkedTitle } from '@metrack/domain';
import type { UserScope } from '../../users/UserScope.js';
import { unlinkedTitleTable } from '../mapping/unlinkedTitleTable.js';
import type { UnlinkedTitleRepository } from '../repositories/UnlinkedTitleRepository.js';
import type { D1Database } from './D1Database.js';
import { D1PlainTableRepository } from './D1PlainTableRepository.js';

export class D1UnlinkedTitleRepository
  extends D1PlainTableRepository<UnlinkedTitle>
  implements UnlinkedTitleRepository
{
  constructor(db: D1Database, scope: UserScope) {
    super(db, scope, unlinkedTitleTable);
  }

  async findBySourceRef(source: string, sourceRef: string): Promise<UnlinkedTitle | undefined> {
    return (
      await this.all('source = ? AND source_ref = ? ORDER BY id LIMIT 1', source, sourceRef)
    )[0];
  }
}
