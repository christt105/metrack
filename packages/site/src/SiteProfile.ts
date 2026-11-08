import type { GiscusConfig } from '@metrack/domain';

/** The texts and image a user chose for the header of their public pages. */
export interface SiteProfile {
  /** Stored image reference of the avatar. */
  avatar: string | null;
  intro: string | null;
  description: string | null;
  /** Markdown shown on the about page; the page does not exist without it. */
  about: string | null;
  /** Where comments on item pages live; they are off without it. */
  giscus: GiscusConfig | null;
}
