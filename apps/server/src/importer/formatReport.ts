import { collectImageSources } from './collectImageSources.js';
import type { LegacyImageIndex } from './LegacyImageIndex.js';
import { summarizeRemoteImages } from './summarizeRemoteImages.js';
import { ISSUE_DESCRIPTIONS, type IssueCode } from './IssueCode.js';
import type { ImportPlan } from './ImportPlan.js';

const PREVIEW_LIMIT = 8;

/**
 * Renders the import plan: counts per type, notes with problems and the unlinked inbox. `applied` only
 * changes the header, as the result of the write is printed after the report.
 */
export function formatReport(
  plan: ImportPlan,
  verbose: boolean,
  legacyImages: LegacyImageIndex | null = null,
  applied = false,
): string {
  const lines: string[] = [];
  const seasonCount = plan.series.reduce((sum, series) => sum + series.seasons.length, 0);
  const implicit = plan.series.filter((series) => series.implicitSeason).length;
  const unlinkedBy = (type: string): number =>
    plan.unlinked.filter((title) => title.mediaType === type).length;

  lines.push(applied ? 'Import report (applied)' : 'Import report (nothing was written)', '');
  lines.push(applied ? 'Planned:' : 'Would import:');
  lines.push(`  movies:     ${plan.movies.length}`);
  lines.push(`  series:     ${plan.series.length}`);
  lines.push(
    `  seasons:    ${seasonCount} (${seasonCount - implicit} from season notes, ${implicit} implicit from single-season series notes)`,
  );
  lines.push(`  videogames: ${plan.videogames.length}`);
  lines.push(`  books:      ${plan.books.length}`);
  lines.push('');
  lines.push(`Unlinked inbox: ${plan.unlinked.length}`);
  for (const type of ['movie', 'series', 'season', 'videogame', 'book']) {
    if (unlinkedBy(type) > 0) lines.push(`  ${type}: ${unlinkedBy(type)}`);
  }
  lines.push('');

  const local = collectImageSources(plan).filter((image) => image.kind === 'local').length;
  const remote = summarizeRemoteImages(plan, legacyImages);
  lines.push('Images:');
  lines.push(`  local files to import: ${local}`);
  lines.push(
    legacyImages
      ? `  remote URLs: ${remote.total} (${remote.resolved} found in the images directories, ${remote.unresolved.length} without a local copy; nothing is downloaded)`
      : `  remote URLs: ${remote.total} (only linked when a local copy already exists; nothing is downloaded)`,
  );
  if (legacyImages && remote.unresolved.length > 0) {
    const shown = verbose ? remote.unresolved : remote.unresolved.slice(0, PREVIEW_LIMIT);
    lines.push('  unresolved:', ...shown.map((url) => `    ${url}`));
    if (shown.length < remote.unresolved.length) {
      lines.push(`    ... ${remote.unresolved.length - shown.length} more (use --verbose)`);
    }
  }
  lines.push('');

  const notes = Object.entries(plan.notesRead)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(', ');
  lines.push(`Notes read: ${notes || 'none'}`, '');

  const byCode = new Map<IssueCode, typeof plan.issues>();
  for (const issue of plan.issues)
    byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue]);
  lines.push(`Problems: ${plan.issues.length} in ${byCode.size} categories`);
  for (const [code, issues] of byCode) {
    lines.push('', `${code} (${issues.length}): ${ISSUE_DESCRIPTIONS[code]}`);
    const shown = verbose ? issues : issues.slice(0, PREVIEW_LIMIT);
    for (const issue of shown)
      lines.push(`  ${issue.path}${issue.detail ? ` [${issue.detail}]` : ''}`);
    if (shown.length < issues.length)
      lines.push(`  ... ${issues.length - shown.length} more (use --verbose)`);
  }

  if (plan.unlinked.length > 0) {
    lines.push('', 'Unlinked titles:');
    const shown = verbose ? plan.unlinked : plan.unlinked.slice(0, PREVIEW_LIMIT);
    for (const title of shown) lines.push(`  ${title.mediaType}: ${title.title} (${title.path})`);
    if (shown.length < plan.unlinked.length) {
      lines.push(`  ... ${plan.unlinked.length - shown.length} more (use --verbose)`);
    }
  }
  return lines.join('\n');
}
