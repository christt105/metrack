/** The one database capability the playback reader needs; satisfied by a `pg` pool. */
export interface SqlQuery {
  query(text: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
