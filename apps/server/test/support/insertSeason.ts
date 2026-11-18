import type { Season } from '@metrack/domain';
import { emptySeason } from '../../src/media/emptyEntities.js';
import type { AsyncUserScope } from '../../src/users/AsyncUserScope.js';
import type { TestApi } from './createTestApi.js';

/** Stores a season straight in the repository, the way the sync or a refresh would, for the given user. */
export async function insertSeason(
  api: TestApi,
  seriesId: number,
  fields: Partial<Season> & { number: number },
  as?: { scope: AsyncUserScope; userId: number },
): Promise<Season> {
  const create = () => api.seasons.create({ ...emptySeason(), ...fields, seriesId });
  return as ? as.scope.run(as.userId, create) : create();
}
