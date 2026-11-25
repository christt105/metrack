import { escapeHtml } from '@metrack/export';
import type { PieSlice } from './PieSlice.js';
import { renderStatBars, type StatBar } from './renderStatBars.js';

export type { PieSlice } from './PieSlice.js';

const PIE_COLORS = [
  '#9fc7b8',
  '#dcb86d',
  '#b9cf8f',
  '#e8a39a',
  '#a9b7e0',
  '#d7a6c9',
  '#7fb6b0',
  '#e0b48a',
  '#8fb3d9',
  '#c4a7e7',
  '#a3c585',
  '#e6a4a4',
];

export function pieColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length] as string;
}

const RADIUS = 100 / (2 * Math.PI);

function donut(slices: PieSlice[], total: number): string {
  let start = 0;
  const arcs = slices.map((slice) => {
    const length = total === 0 ? 0 : (slice.count / total) * 100;
    const arc = `<circle cx="21" cy="21" r="${RADIUS.toFixed(4)}" fill="none" stroke="${escapeHtml(slice.color)}" stroke-width="7" stroke-dasharray="${length.toFixed(3)} ${(100 - length).toFixed(3)}" stroke-dashoffset="${(25 - start).toFixed(3)}"/>`;
    start += length;
    return arc;
  });
  return `<svg class="donut" viewBox="0 0 42 42" aria-hidden="true" focusable="false">${arcs.join('')}</svg>`;
}

/** Bars next to a donut chart with its legend. */
export function renderStatsSplit(title: string, bars: StatBar[], slices: PieSlice[]): string {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const legend = slices
    .map(
      (slice) =>
        `<li><svg class="legend-dot" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><circle cx="5" cy="5" r="5" fill="${escapeHtml(slice.color)}"/></svg><span class="legend-label">${escapeHtml(slice.name)}</span><span class="legend-value">${slice.percent ?? Math.round((slice.count / total) * 100)}%</span></li>`,
    )
    .join('');
  return `<section class="stats-section"><h2 class="section-title">${escapeHtml(title)}</h2><div class="stats-split">${renderStatBars(bars, true)}<div class="pie">${donut(slices, total)}<ul class="legend">${legend}</ul></div></div></section>`;
}
