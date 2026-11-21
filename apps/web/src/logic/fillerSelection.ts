import type { FillerCategory, FillerPreviewEpisode } from '@metrack/domain';
import type { FillerSkipGroup } from './FillerSkipGroup';

/** The categories the preview offers to skip; canon episodes are never proposed. */
export const SKIPPABLE_CATEGORIES: readonly FillerCategory[] = ['filler', 'mixed'];

export const fillerId = (episode: Pick<FillerPreviewEpisode, 'seasonId' | 'key'>): string =>
  `${episode.seasonId}:${episode.key}`;

/** Whether the preview may skip the episode: it is neither watched nor already skipped. */
export const isSkippable = (episode: FillerPreviewEpisode): boolean =>
  SKIPPABLE_CATEGORIES.includes(episode.category) && !episode.watched && !episode.skipped;

/** The episodes of one offered category, in order. */
export const episodesOfCategory = (
  episodes: readonly FillerPreviewEpisode[],
  category: FillerCategory,
): FillerPreviewEpisode[] => episodes.filter((episode) => episode.category === category);

/** What is selected at first: every skippable filler episode, and no mixed one. */
export function defaultSelection(episodes: readonly FillerPreviewEpisode[]): Set<string> {
  return new Set(
    episodes
      .filter((episode) => episode.category === 'filler' && isSkippable(episode))
      .map(fillerId),
  );
}

/** Selects or clears every skippable episode of a category, leaving the others as they are. */
export function setCategory(
  selection: ReadonlySet<string>,
  episodes: readonly FillerPreviewEpisode[],
  category: FillerCategory,
  on: boolean,
): Set<string> {
  const next = new Set(selection);
  for (const episode of episodesOfCategory(episodes, category)) {
    if (!isSkippable(episode)) continue;
    if (on) next.add(fillerId(episode));
    else next.delete(fillerId(episode));
  }
  return next;
}

/** Whether all, some or none of the skippable episodes of a category are selected. */
export function categoryState(
  selection: ReadonlySet<string>,
  episodes: readonly FillerPreviewEpisode[],
  category: FillerCategory,
): 'all' | 'some' | 'none' {
  const skippable = episodesOfCategory(episodes, category).filter(isSkippable);
  const chosen = skippable.filter((episode) => selection.has(fillerId(episode))).length;
  if (chosen === 0) return 'none';
  return chosen === skippable.length ? 'all' : 'some';
}

/** The skips to send, one group per season in season order, for the selected skippable episodes. */
export function skipGroups(
  selection: ReadonlySet<string>,
  episodes: readonly FillerPreviewEpisode[],
): FillerSkipGroup[] {
  const groups: FillerSkipGroup[] = [];
  for (const episode of episodes) {
    if (!isSkippable(episode) || !selection.has(fillerId(episode))) continue;
    const last = groups[groups.length - 1];
    if (last && last.seasonId === episode.seasonId) last.keys.push(episode.key);
    else groups.push({ seasonId: episode.seasonId, keys: [episode.key] });
  }
  return groups;
}
