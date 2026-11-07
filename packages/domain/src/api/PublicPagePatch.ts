/** Some of the public page to change; a `null` or empty handle clears it. */
export interface PublicPagePatch {
  handle?: string | null;
  enabled?: boolean;
}
