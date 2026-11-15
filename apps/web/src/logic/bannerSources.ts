import { sizedImageUrl } from '@metrack/domain';
import type { ImageSources } from './ImageSources';

const WIDTHS: Record<string, { cover: number; banner: number }> = {
  'image.tmdb.org': { cover: 780, banner: 1280 },
  'images.igdb.com': { cover: 1280, banner: 1920 },
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** The address and, where the provider serves several sizes, the `srcset` of a wide banner. */
export function bannerSources(url: string): ImageSources {
  const widths = WIDTHS[hostOf(url) ?? ''];
  const src = sizedImageUrl(url, 'banner');
  if (!widths) return { src, srcset: undefined };
  return {
    src,
    srcset: `${sizedImageUrl(url, 'cover')} ${widths.cover}w, ${src} ${widths.banner}w`,
  };
}
