import { createHash } from 'node:crypto';

/**
 * The file name the previous Hugo migration script gave to the cached copy of an image source.
 * Provider URLs use the provider image id; anything else uses the MD5 of the whole value.
 */
export function legacyImageName(source: string): string {
  const last = source.split('/').at(-1) ?? '';
  const dotted = last.split('.');
  const id = dotted[0] ?? '';
  const ext = dotted[1];

  if (source.includes('tmdb.org') && ext !== undefined) return `tmdb_${id}.${ext}`;
  if (source.includes('thetvdb.com') && ext !== undefined) return `tvdb_${id}.${ext}`;
  if (source.includes('steamgriddb') && ext !== undefined) return `steamgriddb_${id}.${ext}`;
  if (source.includes('steamstatic.com')) {
    const parts = source.split('/');
    const appId = parts.at(-2);
    if (appId !== undefined) {
      const name = last.split('.')[0];
      const steamExt = (last.split('.').at(-1) ?? '').split('?')[0];
      return `steam_${appId}_${name}.${steamExt}`;
    }
  }

  let extension = '.jpg';
  if (source.includes('.')) {
    const candidate = (source.split('.').at(-1) ?? '').split('?')[0] ?? '';
    if (candidate.length <= 4) extension = `.${candidate}`;
  }
  return `img_${createHash('md5').update(source, 'utf8').digest('hex')}${extension}`;
}
