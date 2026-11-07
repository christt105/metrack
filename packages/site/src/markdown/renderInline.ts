import { escapeHtml } from '@metrack/export';
import { imageSrc } from '../imageSrc.js';
import type { MarkdownContext } from './MarkdownContext.js';

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;
const YOUTUBE = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+|https?:\/\/youtu\.be\/[\w-]+/g;

/** Renders the inline syntax of a line: code, images, links, wikilinks, bold, italic and strikethrough. Raw HTML is always escaped. */
export function renderInline(source: string, context: MarkdownContext): string {
  const stash: string[] = [];
  const keep = (html: string): string => `\uE000${stash.push(html) - 1}\uE000`;
  let text = source.replaceAll('\uE000', '');

  text = text.replace(/`([^`]+)`/g, (_whole, code: string) =>
    keep(`<code>${escapeHtml(code)}</code>`),
  );
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_whole, alt: string, target: string) => {
    const src = imageSrc(target, context.handle, 'cover', context.origin);
    return src === null
      ? escapeHtml(alt)
      : keep(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_whole, label: string, target: string) =>
    SAFE_LINK.test(target)
      ? `${keep(`<a href="${escapeHtml(target)}" rel="noopener noreferrer">`)}${label}${keep('</a>')}`
      : label,
  );
  text = text.replace(/\[\[(.*?)\]\]/g, (_whole, inner: string) => {
    const pipe = inner.indexOf('|');
    const target = pipe < 0 ? inner : inner.slice(0, pipe);
    const alias = pipe < 0 ? inner : inner.slice(pipe + 1);
    const name = (target.split('/').at(-1) ?? target).replace(/\.md$/, '');
    const href = context.linkFor(name);
    return href === null
      ? escapeHtml(alias)
      : keep(`<a href="${escapeHtml(context.origin + href)}">${escapeHtml(alias)}</a>`);
  });
  text = text.replace(YOUTUBE, (url) =>
    keep(`<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(url)}</a>`),
  );

  let html = escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*)_(?![_\w])/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  html = html.replace(/\uE000(\d+)\uE000/g, (_whole, index: string) => stash[Number(index)] ?? '');
  return html;
}
