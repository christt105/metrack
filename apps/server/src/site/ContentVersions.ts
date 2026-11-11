/**
 * A counter per user that grows whenever anything a public page shows may have changed. Every writer must bump
 * it: the API through `bumpContentVersionOnWrite`, and any job that writes outside a request (sync, imports).
 */
export interface ContentVersions {
  bump(userId: number): Promise<void>;
}
