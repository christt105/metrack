import type { FinishedViewing } from './FinishedViewing.js';
import { yearOf } from './yearOf.js';

/** The horizontal list of years that jumps to each year of finished items; undated items are the `?` entry. */
export function renderYearNav(viewings: FinishedViewing[]): string {
  if (viewings.length === 0) return '';
  const years = [...new Set(viewings.map((viewing) => yearOf(viewing.date)))];
  const dated = years
    .filter((year): year is string => year !== null)
    .sort()
    .reverse();
  const links = dated.map((year) => `<a href="#year-${year}" class="year-nav-link">${year}</a>`);
  if (years.includes(null)) links.push('<a href="#year-unknown" class="year-nav-link">?</a>');
  return `<div class="year-nav-container"><div class="year-nav-scroll">${links.join('')}</div></div>`;
}
