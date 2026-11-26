/** `text` cut at a word boundary so it fits in `limit` characters, with an ellipsis when something was cut. */
export function shortText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`;
}
