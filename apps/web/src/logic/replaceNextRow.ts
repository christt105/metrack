import type { NextEpisodeRow } from '@metrack/domain';

/** The list with the row of `seriesId` taken out and, when `row` is given, put first as the most recent activity. */
export function replaceNextRow(
  rows: readonly NextEpisodeRow[],
  seriesId: number,
  row: NextEpisodeRow | null,
): NextEpisodeRow[] {
  const rest = rows.filter((existing) => existing.series.id !== seriesId);
  return row ? [row, ...rest] : rest;
}
