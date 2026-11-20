import type { Library } from './Library.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { ownerName } from './ownerName.js';
import { renderLayout } from './renderLayout.js';
import { assetPath } from './sitePaths.js';

const page = (messages: SiteMessages): string => {
  const c = messages.collage;
  return `<script src="${assetPath('html2canvas-pro.js')}"></script><div class="collage-wrapper"><button class="collage-controls-toggle" id="controls-toggle" aria-expanded="true" aria-controls="collage-controls-panel"><i class="fas fa-sliders-h"></i> <span id="toggle-label">${c.hideControls}</span></button><aside class="collage-controls" id="collage-controls-panel"><h2>${c.settings}</h2><div class="control-group"><label>📅 ${c.from}</label><input type="date" id="start-date"></div><div class="control-group"><label>📅 ${c.to}</label><input type="date" id="end-date"></div><div class="control-group"><label>${c.type}</label><div class="checkbox-wrapper"><label><input type="checkbox" value="movie" checked> ${c.movies}</label><label><input type="checkbox" value="tv" checked> ${c.series}</label><label><input type="checkbox" value="videogame" checked> ${c.games}</label><label><input type="checkbox" value="book" checked> ${c.books}</label></div></div><div class="control-group"><label>${c.columns} <span id="col-val">5</span></label><input type="range" id="columns-range" min="2" max="20" value="5"></div><div class="control-stats">${c.itemsFound} <strong id="count-display">0</strong></div><button id="download-btn" class="btn-download"><i class="fas fa-download"></i> ${c.download}</button></aside><div class="collage-preview-area"><div class="canvas-scaler"><div id="collage-canvas"></div></div></div></div>`;
};

/** The collage page: a cover grid of what was finished in a period, drawn in the browser from the library index. */
export function renderCollage(library: Library): string {
  return renderLayout({
    library,
    title: `${library.messages.collage.title} | ${ownerName(library)}`,
    active: 'collage',
    styles: ['collage.css'],
    page: page(library.messages),
    scripts: ['collage.js'],
  });
}
