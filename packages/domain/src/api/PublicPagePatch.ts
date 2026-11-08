import type { GiscusConfig } from './GiscusConfig.js';

/** Some of the public page to change; a `null` or empty handle clears it, and a `null` text, avatar or giscus clears that part. */
export interface PublicPagePatch {
  handle?: string | null;
  enabled?: boolean;
  avatar?: string | null;
  intro?: string | null;
  description?: string | null;
  about?: string | null;
  giscus?: GiscusConfig | null;
}
