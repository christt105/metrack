import type { EpisodeOperation, SeasonEpisodeItem } from '@metrack/domain';

/**
 * The operations that put the watches back as they were before `operation`. Marking is undone by unmarking only
 * the episodes that were not watched; removing or editing viewings is undone by restoring the previous viewings.
 */
export function inverseOperations(
  operation: EpisodeOperation,
  before: readonly SeasonEpisodeItem[],
): EpisodeOperation[] {
  const byKey = new Map(before.map((episode) => [episode.key, episode]));
  if (operation.op === 'mark') {
    const added = operation.keys.filter((key) => byKey.get(key)?.watched === false);
    return added.length > 0 ? [{ op: 'unmark', keys: added }] : [];
  }
  if (operation.op === 'unmark') {
    return operation.keys.flatMap((key): EpisodeOperation[] => {
      const episode = byKey.get(key);
      return episode?.watched ? [{ op: 'setViewings', key, viewings: episode.viewings }] : [];
    });
  }
  const episode = byKey.get(operation.key);
  if (!episode) return [];
  return episode.watched
    ? [{ op: 'setViewings', key: operation.key, viewings: episode.viewings }]
    : [{ op: 'unmark', keys: [operation.key] }];
}
