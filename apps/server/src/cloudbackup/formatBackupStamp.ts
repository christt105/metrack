/** The UTC timestamp the home backups use in their names, for example `20261114T043012345Z`. */
export function formatBackupStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace('.', '');
}
