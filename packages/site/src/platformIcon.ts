/** Font Awesome classes of the icon of a gaming platform, from its name. */
export function platformIcon(platform: string): string {
  const name = platform.toLowerCase();
  if (name === 'steam deck' || name === 'steam') return 'fa-brands fa-steam';
  if (name === 'pc' || name === 'windows') return 'fas fa-desktop';
  if (name === 'mac' || name === 'macos') return 'fa-brands fa-apple';
  if (name === 'linux') return 'fa-brands fa-linux';
  if (name === 'mobile' || name === 'android' || name === 'ios') return 'fas fa-mobile-screen';
  if (name === 'switch') return 'fas fa-gamepad';
  if (name.includes('ps')) return 'fa-brands fa-playstation';
  if (name.includes('xbox')) return 'fa-brands fa-xbox';
  return 'fas fa-gamepad';
}
