import { escapeHtml } from '@metrack/export';
import type { MarkdownContext } from './MarkdownContext.js';
import { renderInline } from './renderInline.js';

const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const FENCE = /^```/;

/** Renders a review as HTML: headings, paragraphs, lists, quotes, rules and code blocks, with inline syntax. Raw HTML is escaped. */
export function renderMarkdown(source: string, context: MarkdownContext): string {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const blocks: string[] = [];
  let index = 0;
  const inline = (text: string): string => renderInline(text, context);
  const startsBlock = (line: string): boolean =>
    HEADING.test(line) ||
    RULE.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    QUOTE.test(line) ||
    FENCE.test(line);

  while (index < lines.length) {
    const line = lines[index] as string;
    if (line.trim() === '') {
      index++;
    } else if (FENCE.test(line)) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !FENCE.test(lines[index] as string))
        code.push(lines[index++] as string);
      index++;
      blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    } else if (HEADING.test(line)) {
      const [, hashes = '#', text = ''] = HEADING.exec(line) ?? [];
      const level = Math.min(hashes.length + (context.headingOffset ?? 1), 6);
      blocks.push(`<h${level}>${inline(text.trim())}</h${level}>`);
      index++;
    } else if (RULE.test(line)) {
      blocks.push('<hr>');
      index++;
    } else if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] as string)) {
        quoted.push(QUOTE.exec(lines[index++] as string)?.[1] ?? '');
      }
      blocks.push(`<blockquote>${renderMarkdown(quoted.join('\n'), context)}</blockquote>`);
    } else if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index] as string)) {
        items.push(`<li>${inline(pattern.exec(lines[index++] as string)?.[1] ?? '')}</li>`);
      }
      blocks.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
    } else {
      const paragraph: string[] = [];
      while (
        index < lines.length &&
        (lines[index] as string).trim() !== '' &&
        (paragraph.length === 0 || !startsBlock(lines[index] as string))
      ) {
        paragraph.push((lines[index++] as string).trim());
      }
      blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
  }
  return blocks.join('\n');
}
