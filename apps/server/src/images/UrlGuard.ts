/** Decides whether the server may fetch a URL a user typed. */
export interface UrlGuard {
  /** Throws `ImageRejectedError` when the URL must not be fetched. */
  check(url: URL): Promise<void>;
}
