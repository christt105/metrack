const STAMP = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/;

/** Reads a timestamp written by `formatBackupStamp`; undefined when it does not match. */
export function parseBackupStamp(stamp: string): Date | undefined {
  const match = STAMP.exec(stamp);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s, ms] = match;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`);
}
