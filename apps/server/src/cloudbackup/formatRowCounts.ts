/** One `table: rows` line per table, plus the total. */
export function formatRowCounts(counts: Record<string, number>): string {
  const lines = Object.entries(counts).map(([name, rows]) => `${name}: ${rows}`);
  const total = Object.values(counts).reduce((sum, rows) => sum + rows, 0);
  return [...lines, `total: ${total}`].join('\n');
}
