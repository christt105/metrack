import type { EpisodeOperation, SeasonEpisodeItem, Viewing } from '@metrack/domain';

const dated = (viewings: readonly Viewing[]): Viewing[] =>
  viewings.filter((viewing) => viewing.finishedAt !== null || viewing.abandonedAt !== undefined);

/**
 * The operations that put the watches and skips back as they were before `operation`. Marking is undone by
 * unmarking the episodes that were not watched, restoring the viewings of those that were and skipping again the
 * ones it unskipped; removing or editing viewings is undone by restoring the previous viewings; skipping is
 * undone by unskipping, after putting back the undated watch it removed.
 */
export function inverseOperations(
  operation: EpisodeOperation,
  before: readonly SeasonEpisodeItem[],
): EpisodeOperation[] {
  const byKey = new Map(before.map((episode) => [episode.key, episode]));
  const episodesOf = (keys: readonly string[]) =>
    keys.flatMap((key) => {
      const episode = byKey.get(key);
      return episode ? [episode] : [];
    });

  if (operation.op === 'skip') {
    const restore = episodesOf(operation.keys).filter((e) => e.watched && !e.skipped);
    const rest = episodesOf(operation.keys).filter((e) => !e.skipped && !e.watched);
    return [
      ...restore.map((e): EpisodeOperation => ({ op: 'setViewings', key: e.key, viewings: [] })),
      ...(rest.length > 0 ? [{ op: 'unskip', keys: rest.map((e) => e.key) } as const] : []),
    ];
  }
  if (operation.op === 'unskip') {
    const skipped = episodesOf(operation.keys).filter((e) => e.skipped);
    return skipped.length > 0 ? [{ op: 'skip', keys: skipped.map((e) => e.key) }] : [];
  }
  if (operation.op === 'mark') {
    const touched = episodesOf(operation.keys);
    const added = touched.filter((e) => !e.watched && !e.skipped).map((e) => e.key);
    const skipped = touched.filter((e) => e.skipped).map((e) => e.key);
    return [
      ...(added.length > 0 ? [{ op: 'unmark', keys: added } as const] : []),
      ...touched
        .filter((e) => e.watched && !e.skipped)
        .map((e): EpisodeOperation => ({
          op: 'setViewings',
          key: e.key,
          viewings: dated(e.viewings),
        })),
      ...(skipped.length > 0 ? [{ op: 'skip', keys: skipped } as const] : []),
    ];
  }
  if (operation.op === 'unmark') {
    return episodesOf(operation.keys)
      .filter((e) => e.watched)
      .map((e): EpisodeOperation => ({
        op: 'setViewings',
        key: e.key,
        viewings: dated(e.viewings),
      }));
  }
  const episode = byKey.get(operation.key);
  if (!episode) return [];
  const restored: EpisodeOperation = episode.watched
    ? { op: 'setViewings', key: operation.key, viewings: dated(episode.viewings) }
    : { op: 'unmark', keys: [operation.key] };
  const back: EpisodeOperation[] = episode.skipped ? [{ op: 'skip', keys: [operation.key] }] : [];
  return [restored, ...back];
}
