export interface RedirectOptions {
  /** Address of the new site without a trailing slash, for example `https://media.example.com`. */
  newOrigin: string;
  /** Path the old site was served under, removed before the rest is appended to the new address. */
  oldBasePath?: string;
}
