import type { ExportImage } from './ExportImage.js';
import { imageFileName } from './imageFileName.js';

const WIKILINK = /(?<!!)\[\[(.*?)\]\]/g;
const YOUTUBE = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+|https?:\/\/youtu\.be\/[\w-]+/g;
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

export interface ConvertedBody {
  text: string;
  /** Stored images the text now refers to by file name. */
  images: ExportImage[];
}

function youtubeId(url: string): string | null {
  if (url.includes('youtube.com/watch?v=')) return url.split('v=')[1]?.split('&')[0] ?? null;
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0] ?? null;
  return null;
}

/**
 * Turns a review into Hugo markdown: stored images become bundle file names, wikilinks to known
 * pages become `ref` links (other wikilinks keep only their text) and YouTube links become
 * shortcodes.
 */
export function convertBody(
  review: string,
  knownSlugs: ReadonlySet<string>,
  imagesByRef: ReadonlyMap<string, ExportImage>,
): ConvertedBody {
  const images: ExportImage[] = [];
  let text = review.replace(IMAGE, (whole: string, alt: string, target: string) => {
    const image = imagesByRef.get(target);
    if (!image) return whole;
    images.push(image);
    return `![${alt}](${imageFileName(image)})`;
  });
  text = text.replace(WIKILINK, (_whole: string, inner: string) => {
    const pipe = inner.indexOf('|');
    const target = pipe < 0 ? inner : inner.slice(0, pipe);
    const alias = pipe < 0 ? inner : inner.slice(pipe + 1);
    let name = target.split('/').at(-1) ?? target;
    if (name.endsWith('.md')) name = name.slice(0, -3);
    return knownSlugs.has(name) ? `[${alias}]({{< ref "${name}" >}})` : alias;
  });
  text = text.replace(YOUTUBE, (url: string) => {
    const id = youtubeId(url);
    return id ? `{{< youtube ${id} >}}` : url;
  });
  return { text, images };
}
