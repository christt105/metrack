import type { IconName } from './IconName.js';

const PATHS: Record<IconName, string> = {
  movie:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>',
  tv: '<rect x="3" y="6.5" width="18" height="12.5" rx="2"/><path d="m8.5 3 3.5 3.5L15.5 3"/>',
  videogame:
    '<path d="M7.5 7.5h9a4.5 4.5 0 0 1 4.4 5.4l-.8 3.8a2.3 2.3 0 0 1-4 1L14.5 16h-5l-1.6 1.7a2.3 2.3 0 0 1-4-1l-.8-3.8a4.5 4.5 0 0 1 4.4-5.4z"/><path d="M8 10.5v3M6.5 12h3M15 11h.01M17 13h.01"/>',
  book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v14h-13a2 2 0 0 0-2 2z"/><path d="M4.5 19.5a2 2 0 0 0 2 2h13v-4"/>',
  trophy:
    '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3 3 0 0 0 8 10.5M16 6h3.5v1.5a3 3 0 0 1-3.5 3M12 13v4M8.5 20h7M10 17h4"/>',
  review:
    '<path d="M6.5 3.5h7l4.5 4.5v12.5h-11.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5V8H18M8.5 12.5h7M8.5 16h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20.5 20.5-4.9-4.9"/>',
  rss: '<path d="M5 11a8 8 0 0 1 8 8M5 4.5A14.5 14.5 0 0 1 19.5 19"/><circle cx="6" cy="18" r="1.2" fill="currentColor"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  sliders:
    '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  desktop: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>',
  mobile: '<rect x="6.5" y="3" width="11" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
  externalLink:
    '<path d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 14v3.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2H10"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z" fill="currentColor" stroke="none"/>',
  crown: '<path d="M4 18.5h16M4.5 17 3.5 8l4.8 4L12 5.5l3.7 6.5 4.8-4-1 9z"/>',
  heart:
    '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>',
  thumbsUp:
    '<path d="M8 10.5V19H4.5v-8.5zM8 10.5l3.2-6.2c1.6 0 2.4 1.2 2 2.7L12.6 9.5h5.3a1.9 1.9 0 0 1 1.9 2.3l-1.2 5.6a2.4 2.4 0 0 1-2.3 1.6H8"/>',
  smile:
    '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c.9 1.4 2.1 2.1 3.5 2.1s2.6-.7 3.5-2.1M9 9.5h.01M15 9.5h.01"/>',
  thumbsDown:
    '<path d="M8 13.5V5H4.5v8.5zM8 13.5l3.2 6.2c1.6 0 2.4-1.2 2-2.7l-.6-2.5h5.3a1.9 1.9 0 0 0 1.9-2.3l-1.2-5.6A2.4 2.4 0 0 0 16.3 4.5H8"/>',
  dizzy:
    '<circle cx="12" cy="12" r="8.5"/><path d="m7.8 8.3 2.4 2.4m0-2.4-2.4 2.4M13.8 8.3l2.4 2.4m0-2.4-2.4 2.4M9 16c1-1.1 2-1.1 3 0s2 1.1 3 0"/>',
  skull:
    '<path d="M12 3.8a7.5 7.5 0 0 0-7.5 7.5c0 2.4 1.1 4 2.9 5v3.4h9.2v-3.4c1.8-1 2.9-2.6 2.9-5A7.5 7.5 0 0 0 12 3.8z"/><path d="M9.2 11.5h.01M14.8 11.5h.01M10.5 19.7v-2.3M13.5 19.7v-2.3"/>',
};

/** A glyph from the page's sprite, drawn with the current text colour and hidden from assistive technology. */
export function icon(name: IconName, size = 18): string {
  return `<svg class="icon" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}

/** Every glyph once, as symbols `icon` points at; each page that uses icons carries it. */
export function iconSprite(): string {
  const symbols = Object.entries(PATHS)
    .map(([name, paths]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${paths}</symbol>`)
    .join('');
  return `<svg class="sprite" aria-hidden="true" focusable="false">${symbols}</svg>`;
}
