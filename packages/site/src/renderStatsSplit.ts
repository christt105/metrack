import { escapeHtml } from '@metrack/export';
import { renderStatBars, type StatBar } from './renderStatBars.js';

export interface PieSlice {
  name: string;
  count: number;
  color: string;
  /** The share written in the legend; defaults to the rounded share of the total. */
  percent?: number;
}

const PIE_COLORS = [
  '#4f8cff',
  '#f59e0b',
  '#22c55e',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#0ea5e9',
  '#d946ef',
  '#84cc16',
  '#fb7185',
];

export function pieColor(index: number): string {
  return PIE_COLORS[index % PIE_COLORS.length] as string;
}

/** Bars next to a conic pie with its legend. */
export function renderStatsSplit(title: string, bars: StatBar[], slices: PieSlice[]): string {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  let cumulative = 0;
  const stops = slices.map((slice) => {
    const end = cumulative + (slice.count / total) * 100;
    const stop = `${slice.color} ${cumulative.toFixed(2)}% ${end.toFixed(2)}%`;
    cumulative = end;
    return stop;
  });
  const legend = slices
    .map(
      (slice) =>
        `<div class="pie-legend-item"><span class="legend-dot" style="background:${slice.color};"></span><span class="legend-label">${escapeHtml(slice.name)}</span><span class="legend-pct">${slice.percent ?? Math.round((slice.count / total) * 100)}%</span></div>`,
    )
    .join('');
  return `<section class="stats-section"><h2 class="section-title">${escapeHtml(title)}</h2><div class="stats-split">${renderStatBars(bars, true)}<div class="pie-wrap"><div class="pie-chart" style="background:conic-gradient(${stops.join(',')});"></div><div class="pie-legend">${legend}</div></div></div></section>`;
}
