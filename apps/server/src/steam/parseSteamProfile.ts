import type { SteamProfileReference } from './SteamProfileReference.js';

const STEAM_ID64 = /^7656119\d{10}$/;
const VANITY = /^[A-Za-z0-9_-]{2,64}$/;
const PROFILE_PATH = /^\/(profiles|id)\/([^/]+)\/?$/;

/**
 * Reads what a user typed for their Steam account: a SteamID64, a profile address
 * (`steamcommunity.com/profiles/<id>` or `/id/<vanity>`) or a bare vanity name. Null when it is none of them.
 */
export function parseSteamProfile(input: string): SteamProfileReference | null {
  const text = input.trim();
  if (STEAM_ID64.test(text)) return { kind: 'id', steamId: text };
  if (/^(https?:\/\/)?(www\.)?steamcommunity\.com\//i.test(text)) {
    let path: string;
    try {
      path = new URL(/^https?:/i.test(text) ? text : `https://${text}`).pathname;
    } catch {
      return null;
    }
    const match = PROFILE_PATH.exec(path);
    const value = match?.[2] ?? '';
    if (match?.[1] === 'profiles')
      return STEAM_ID64.test(value) ? { kind: 'id', steamId: value } : null;
    return VANITY.test(value) ? { kind: 'vanity', name: value } : null;
  }
  return VANITY.test(text) ? { kind: 'vanity', name: text } : null;
}
