import type { EpisodeOperation, SeasonEpisodeItem } from '@metrack/domain';

/**
 * The operations that put the watches back as they were before `operation`. Marking is undone by unmarking only
 * the episodes that were not watched; removing or editing viewings is undone by restoring the previous viewings.
 */
export function inverseOperations(
  operation: EpisodeOperation,
  before: readonly SeasonEpisodeItem[],
): EpisodeOperation[] {
  const byNumber = new Map(before.map((episode) => [episode.number, episode]));
  if (operation.op === 'mark') {
    const added = operation.numbers.filter((number) => byNumber.get(number)?.watched === false);
    return added.length > 0 ? [{ op: 'unmark', numbers: added }] : [];
  }
  if (operation.op === 'unmark') {
    return operation.numbers.flatMap((number): EpisodeOperation[] => {
      const episode = byNumber.get(number);
      return episode?.watched ? [{ op: 'setViewings', number, viewings: episode.viewings }] : [];
    });
  }
  const episode = byNumber.get(operation.number);
  if (!episode) return [];
  return episode.watched
    ? [{ op: 'setViewings', number: operation.number, viewings: episode.viewings }]
    : [{ op: 'unmark', numbers: [operation.number] }];
}
