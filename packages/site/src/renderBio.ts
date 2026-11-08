import { escapeHtml } from '@metrack/export';
import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import { ownerName } from './ownerName.js';
import { assetPath } from './sitePaths.js';

/** The profile header: avatar, intro and description. Without an avatar, a neutral default is shown. */
export function renderBio(library: Library): string {
  const { avatar, description } = library.profile;
  const src = imageSrc(avatar, library.handle, 'thumb') ?? assetPath('default-avatar.svg');
  const bio = description === null ? '' : `<p class="author-bio">${escapeHtml(description)}</p>`;
  return `<div class="profile-header"><div class="author"><img class="author-avatar" src="${escapeHtml(src)}" alt="${escapeHtml(library.handle)}" width="70" height="70"><h2 class="author-name">${escapeHtml(ownerName(library))}</h2>${bio}</div></div>`;
}
