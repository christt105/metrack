import { icon } from './icon.js';
import type { Library } from './Library.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { ownerName } from './ownerName.js';
import { renderLayout } from './renderLayout.js';
import { indexPath } from './sitePaths.js';

const TYPES = ['movie', 'tv', 'videogame', 'book'] as const;

function controls(messages: SiteMessages): string {
  const c = messages.collage;
  const names = { movie: c.movies, tv: c.series, videogame: c.games, book: c.books };
  const types = TYPES.map(
    (type) =>
      `<label class="check"><input type="checkbox" name="type" value="${type}" checked> ${names[type]}</label>`,
  ).join('');
  return `<details class="collage-controls" id="collage-controls" open><summary>${icon('sliders', 18)} ${c.settings}</summary><div class="collage-fields"><label class="field"><span>${c.from}</span><input type="date" id="collage-from"></label><label class="field"><span>${c.to}</span><input type="date" id="collage-to"></label><fieldset class="field"><legend>${c.type}</legend>${types}</fieldset><label class="field"><span>${c.columns} <output id="collage-columns-value">5</output></span><input type="range" id="collage-columns" min="2" max="20" value="5"></label><p class="collage-count">${c.itemsFound} <strong id="collage-count">0</strong></p><button type="button" class="button" id="collage-download">${icon('download', 18)} <span id="collage-download-label">${c.download}</span></button></div></details>`;
}

/** The collage page: a cover grid of what was finished in a period, drawn in the browser from the library index. */
export function renderCollage(library: Library): string {
  const { collage } = library.messages;
  return renderLayout({
    library,
    title: `${collage.title} | ${ownerName(library)}`,
    active: 'collage',
    page: `<main class="wrap collage" aria-label="${library.messages.contentLabel}"><h1 class="visually-hidden">${collage.title}</h1>${controls(library.messages)}<div class="collage-preview"><div class="collage-grid" id="collage-grid"></div></div></main>`,
    data: {
      index: indexPath(library.handle),
      download: collage.download,
      generating: collage.generating,
      tooLarge: collage.tooLarge,
      failed: collage.failed,
    },
  });
}
