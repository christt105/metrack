import type { UnlinkedTitle } from '@metrack/domain';
import type { EntityRepository } from './EntityRepository.js';

/** Inbox of titles with no external id. Resolving one means deleting it after creating the real entity. */
export interface UnlinkedTitleRepository extends EntityRepository<UnlinkedTitle> {
  findBySourceRef(source: string, sourceRef: string): Promise<UnlinkedTitle | undefined>;
}
