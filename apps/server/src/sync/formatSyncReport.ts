import type { SyncPlan } from '@metrack/domain';

/** Renders a plan as text. Counts first, then one line per change; `verbose` lists them all. */
export function formatSyncReport(plan: SyncPlan, verbose: boolean): string {
  const seasons = plan.series.flatMap((s) => s.seasons);
  const count = (action: string) => plan.movies.filter((m) => m.action === action).length;
  const lines = [
    'Jellyfin sync report (nothing was written)',
    `Movies: ${count('create')} to create, ${count('complete')} to complete, ${count('rewatch')} rewatches`,
    `Series: ${plan.series.filter((s) => s.seriesId === null).length} to create, ${plan.series.filter((s) => s.seriesId !== null).length} to update`,
    `Seasons: ${seasons.filter((s) => s.seasonId === null).length} to create, ${seasons.filter((s) => s.seasonId !== null).length} to update, ${seasons.filter((s) => s.status === 'completed').length} completed, ${seasons.filter((s) => s.status === 'in_progress').length} in progress`,
    `Unlinked: ${plan.unlinked.length}`,
    `Warnings: ${plan.warnings.length}`,
    `Playback records with no matching library item: ${plan.ignoredPlays} (${plan.unmatchedTitles.length} titles)`,
    `Finished items still without a rating: ${plan.movies.filter((m) => m.missingRating).length + seasons.filter((s) => s.missingRating).length}`,
  ];
  if (verbose) {
    for (const m of plan.movies) {
      lines.push(
        `movie ${m.action}: ${m.title} finished ${m.finishedAt ?? '-'} rewatches ${m.rewatches.join(',') || '-'}`,
      );
    }
    for (const s of plan.series) {
      lines.push(`series ${s.seriesId === null ? 'create' : 'update'}: ${s.title}`);
      for (const season of s.seasons) {
        lines.push(
          `  season ${season.number} (${season.matchedBy}): ${season.status} ${season.watchedEpisodes}/${season.episodeCount} started ${season.startedAt ?? '-'} finished ${season.finishedAt ?? '-'}`,
        );
      }
    }
    for (const u of plan.unlinked)
      lines.push(`unlinked ${u.mediaType}: ${u.title} (${u.plays} plays)`);
    for (const t of plan.unmatchedTitles) lines.push(`unmatched: ${t.title} (${t.plays} plays)`);
    for (const w of plan.warnings) lines.push(`warning ${w.code}: ${w.title}: ${w.message}`);
  }
  return lines.join('\n');
}
