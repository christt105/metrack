/**
 * Whether a series taken off the next-episode list at `hiddenAt` stays off it: yes while nothing of its episodes
 * changed since. A series without recorded activity counts as older than the removal.
 */
export function isHiddenFromNext(
  hiddenAt: string | undefined,
  lastActivityAt: string | null,
): boolean {
  return hiddenAt !== undefined && hiddenAt >= (lastActivityAt ?? '');
}
