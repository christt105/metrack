import { escapeHtml } from '@metrack/export';
import { avatarSrc } from './avatarSrc.js';
import type { Library } from './Library.js';
import { ownerName } from './ownerName.js';

/** The profile at the top of the library: avatar, name and description over a backdrop the script fills with a random banner. */
export function renderBio(library: Library): string {
  const { description } = library.profile;
  const bio = description === null ? '' : `<p class="profile-bio">${escapeHtml(description)}</p>`;
  return `<section class="profile"><div class="profile-backdrop" id="profile-backdrop"></div><div class="profile-inner"><img class="profile-avatar" src="${escapeHtml(avatarSrc(library))}" alt="" width="72" height="72"><div class="profile-text"><h1 class="profile-name">${escapeHtml(ownerName(library))}</h1>${bio}</div></div></section>`;
}
