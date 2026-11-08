import type { GiscusConfig } from './GiscusConfig.js';

/**
 * A user's public page: the handle it is served under, whether it is switched on and the texts and image
 * of its header. `avatar` is a stored image reference; `about` is Markdown. Comments appear on item pages
 * only while `giscus` is set.
 */
export interface PublicPage {
  handle: string | null;
  enabled: boolean;
  avatar: string | null;
  intro: string | null;
  description: string | null;
  about: string | null;
  giscus: GiscusConfig | null;
}
