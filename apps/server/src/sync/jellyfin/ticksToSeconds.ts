/** Converts Jellyfin's 100-nanosecond ticks to seconds. */
export function ticksToSeconds(ticks: number | null | undefined): number | null {
  return ticks ? Math.round(ticks / 10_000_000) : null;
}
