import type { UserSettings } from '@metrack/domain';

/** A user who set nothing: no background job runs for them. */
export const NO_SETTINGS: UserSettings = {
  jellyfinUser: null,
  ntfyTopic: null,
  publishProject: null,
  publishBaseUrl: null,
  mirrorDir: null,
  mirrorLinkPrefix: null,
};
