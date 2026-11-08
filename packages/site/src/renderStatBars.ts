import { escapeHtml } from '@metrack/export';

export interface StatBar {
  /** Already escaped markup for the name. */
  name: string;
  /** Share of the full track, 0 to 100. */
  percent: number;
  value: string;
  color?: string;
  valueColor?: string;
}

export function renderStatBars(bars: StatBar[], compact = false): string {
  const rows = bars
    .map((bar) => {
      const fill = `width:${bar.percent}%${bar.color ? `; background:${bar.color}` : ''};`;
      const valueStyle = bar.valueColor ? ` style="color:${bar.valueColor};"` : '';
      return `<div class="stat-bar-row"><span class="stat-bar-name">${bar.name}</span><span class="stat-bar-track"><span class="stat-bar-fill" style="${fill}"></span></span><span class="stat-bar-value"${valueStyle}>${escapeHtml(bar.value)}</span></div>`;
    })
    .join('');
  return `<div class="stat-bars${compact ? ' stat-bars-compact' : ''}">${rows}</div>`;
}

export function percentOf(count: number, max: number): number {
  return max <= 0 ? 0 : Math.round((count / max) * 100);
}
