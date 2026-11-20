import type { EditableSetting } from './EditableSetting.js';

/**
 * The settings the owner can change from the web app. The vault folder is left to the command line: the server writes
 * into it, so a web session (with dev login, anyone on the network) must not be able to point it anywhere on disk.
 */
export const WEB_EDITABLE_SETTINGS: readonly EditableSetting[] = [
  'jellyfinUser',
  'ntfyTopic',
  'mirrorLinkPrefix',
];
