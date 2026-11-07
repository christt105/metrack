import type { UserSettings } from '../api/UserSettings.js';

const NTFY_TOPIC = /^[A-Za-z0-9_-]{1,64}$/;
const PAGES_PROJECT = /^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/;
const MAX_LENGTH = 512;

/** Why a value cannot be stored for a setting, or null when it can. The value is already trimmed and not empty. */
export function settingProblem(key: keyof UserSettings, value: string): string | null {
  if (value.length > MAX_LENGTH) return `at most ${MAX_LENGTH} characters`;
  if ([...value].some((char) => char.charCodeAt(0) < 32)) return 'no control characters';
  switch (key) {
    case 'jellyfinUser':
      return null;
    case 'ntfyTopic':
      return NTFY_TOPIC.test(value) ? null : 'letters, digits, "-" and "_", up to 64';
    case 'publishProject':
      return PAGES_PROJECT.test(value)
        ? null
        : 'a Cloudflare Pages project name: lowercase letters, digits and "-", up to 58';
    case 'publishBaseUrl':
      return isWebUrl(value) ? null : 'an http or https address';
    case 'mirrorDir':
      return value.startsWith('/') ? null : 'an absolute path';
    case 'mirrorLinkPrefix':
      return value.startsWith('/') || value.split('/').includes('..')
        ? 'a path inside the vault, without a leading "/" or ".."'
        : null;
  }
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
