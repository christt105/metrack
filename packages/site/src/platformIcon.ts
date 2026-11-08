/** Font Awesome classes of the icon of a gaming platform, from its name. */
export function platformIcon(platform: string): string {
  const name = platform.toLowerCase();
  if (name === 'steam deck' || name === 'steam') return 'fa-brands fa-steam';
  if (name === 'pc' || name === 'windows') return 'fas fa-desktop';
  if (name === 'switch') return 'fas fa-gamepad';
  if (name.includes('ps')) return 'fa-brands fa-playstation';
  if (name.includes('xbox')) return 'fa-brands fa-xbox';
  return 'fas fa-gamepad';
}
