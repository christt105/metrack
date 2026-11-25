import type { IconName } from './IconName.js';

/** The icon of a gaming platform, from its name: computers, phones, or a controller for everything else. */
export function platformIcon(platform: string): IconName {
  const name = platform.toLowerCase();
  if (['pc', 'windows', 'mac', 'macos', 'linux'].includes(name)) return 'desktop';
  if (['mobile', 'android', 'ios'].includes(name)) return 'mobile';
  return 'videogame';
}
