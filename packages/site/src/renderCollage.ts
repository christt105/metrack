import type { Library } from './Library.js';
import { ownerName } from './ownerName.js';
import { renderLayout } from './renderLayout.js';
import { assetPath } from './sitePaths.js';

const PAGE = `<script src="${assetPath('html2canvas-pro.js')}"></script><div class="collage-wrapper"><button class="collage-controls-toggle" id="controls-toggle" aria-expanded="true" aria-controls="collage-controls-panel"><i class="fas fa-sliders-h"></i> <span id="toggle-label">Hide Controls</span></button><aside class="collage-controls" id="collage-controls-panel"><h2>Collage Settings</h2><div class="control-group"><label>📅 From:</label><input type="date" id="start-date"></div><div class="control-group"><label>📅 To:</label><input type="date" id="end-date"></div><div class="control-group"><label>Type:</label><div class="checkbox-wrapper"><label><input type="checkbox" value="movie" checked> Movies</label><label><input type="checkbox" value="tv" checked> Series</label><label><input type="checkbox" value="videogame" checked> Games</label><label><input type="checkbox" value="book" checked> Books</label></div></div><div class="control-group"><label>Columns: <span id="col-val">5</span></label><input type="range" id="columns-range" min="2" max="20" value="5"></div><div class="control-stats">Items found: <strong id="count-display">0</strong></div><button id="download-btn" class="btn-download"><i class="fas fa-download"></i> Download PNG</button></aside><div class="collage-preview-area"><div class="canvas-scaler"><div id="collage-canvas"></div></div></div></div>`;

/** The collage page: a cover grid of what was finished in a period, drawn in the browser from the library index. */
export function renderCollage(library: Library): string {
  return renderLayout({
    library,
    title: `Collage | ${ownerName(library)}`,
    active: 'collage',
    styles: ['collage.css'],
    page: PAGE,
    scripts: ['collage.js'],
  });
}
