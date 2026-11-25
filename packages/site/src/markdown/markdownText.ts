const FENCE = /^\s*```/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** A review as one line of plain text: the words a reader sees, without Markdown syntax, images or code fences. */
export function markdownText(source: string): string {
  return source
    .replaceAll('\r\n', '\n')
    .split('\n')
    .filter((line) => !FENCE.test(line) && !RULE.test(line))
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*>\s?/, '')
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''),
    )
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)\s]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^_\w])_([^_\s][^_]*)_(?![_\w])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}
