import { KNOWN_PLATFORMS } from './KNOWN_PLATFORMS.js';

const ALIASES: Record<string, (typeof KNOWN_PLATFORMS)[number]> = {
  pc: 'PC',
  windows: 'PC',
  'pc (microsoft windows)': 'PC',
  'microsoft windows': 'PC',
  'steam deck': 'Steam Deck',
  mac: 'Mac',
  macos: 'Mac',
  linux: 'Linux',
  switch: 'Switch',
  'nintendo switch': 'Switch',
  ps5: 'PS5',
  'playstation 5': 'PS5',
  ps4: 'PS4',
  'playstation 4': 'PS4',
  'xbox series': 'Xbox Series',
  'xbox series x|s': 'Xbox Series',
  'xbox series x': 'Xbox Series',
  'xbox one': 'Xbox One',
  mobile: 'Mobile',
  android: 'Mobile',
  ios: 'Mobile',
};

/** The canonical name of a platform: known spellings collapse into one, anything else is kept trimmed. */
export function canonicalPlatform(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return ALIASES[trimmed.toLowerCase()] ?? trimmed;
}
