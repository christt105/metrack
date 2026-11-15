/**
 * The id of the only group among the candidates that has a season for every one of these numbers, or null
 * when none or several do. Candidates are the "Seasons" groups of one series with the season numbers (orders)
 * they hold.
 */
export function pickSeasonsGroup(
  candidates: readonly { id: string; seasonNumbers: readonly number[] }[],
  numbers: readonly number[],
): string | null {
  const matching = candidates.filter((c) => numbers.every((n) => c.seasonNumbers.includes(n)));
  return matching.length === 1 ? (matching[0]?.id ?? null) : null;
}
