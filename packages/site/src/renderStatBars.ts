import { escapeHtml } from '@metrack/export';
import type { StatBar } from './StatBar.js';

export type { StatBar } from './StatBar.js';

function track(bar: StatBar): string {
  const fill = bar.color === undefined ? '' : ` fill="${escapeHtml(bar.color)}"`;
  return `<svg class="bar-track" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="bar-fill" width="${bar.percent}" height="1"${fill}/></svg>`;
}

/** Horizontal bars with their names and values. */
export function renderStatBars(bars: StatBar[], compact = false): string {
  const rows = bars
    .map((bar) => {
      const valueClass = bar.valueClass === undefined ? '' : ` ${bar.valueClass}`;
      return `<div class="bar-row"><span class="bar-name">${bar.name}</span>${track(bar)}<span class="bar-value${valueClass}">${escapeHtml(bar.value)}</span></div>`;
    })
    .join('');
  return `<div class="bars${compact ? ' bars-compact' : ''}">${rows}</div>`;
}

export function percentOf(count: number, max: number): number {
  return max <= 0 ? 0 : Math.round((count / max) * 100);
}
