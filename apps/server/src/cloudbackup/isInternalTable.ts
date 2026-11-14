/** Tables SQLite and Cloudflare keep for themselves and that a restore must not write. */
export function isInternalTable(name: string): boolean {
  return name.startsWith('sqlite_') || name.startsWith('_cf_');
}
