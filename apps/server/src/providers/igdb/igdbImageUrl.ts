/** Turns IGDB's protocol-relative thumbnail url into an https url of the given size (`cover_big`, `screenshot_huge`...). */
export function igdbImageUrl(url: string | undefined, size: string): string | null {
  if (!url) return null;
  const absolute = url.startsWith('//') ? `https:${url}` : url;
  return absolute.replace(/\/t_[a-z0-9_]+\//, `/t_${size}/`);
}
