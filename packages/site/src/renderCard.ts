import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { formatDate } from './formatDate.js';
import { coverSrc } from './imageOrDefault.js';
import { STATUS_LABELS, TYPE_LABELS } from './labels.js';
import type { PublicEntry } from './PublicEntry.js';
import { ratingTheme } from './ratingTheme.js';
import { entryPath } from './sitePaths.js';
import { TYPE_ICONS, themeType } from './themeType.js';
import { yearOf } from './yearOf.js';

const pipe = (values: string[]): string => escapeHtml(values.join('|').toLowerCase());

/**
 * A cover card. `date` is the day shown under a finished title, which for a rewatch is the rewatch's;
 * without one the release date is shown.
 */
export function renderCard(handle: string, entry: PublicEntry, date: string | null): string {
  const href = escapeHtml(entryPath(handle, entry.kind, entry.id));
  const status = entryStatus(entry);
  const type = themeType(entry.kind);
  const shownDate = date ?? entry.releaseDate;
  const year = yearOf(date) ?? yearOf(entry.releaseDate) ?? '';
  const rating = status === 'finished' && entry.rating !== null ? ratingTheme(entry.rating) : null;
  const badges = [
    `<div class="badge-type ${type}" title="${TYPE_LABELS[type]}"><i class="${TYPE_ICONS[type]}"></i></div>`,
    entry.review !== null && entry.review.trim() !== ''
      ? '<div class="badge-content" title="Contiene reseña/notas personales"><i class="fas fa-file-alt"></i></div>'
      : '',
    rating === null
      ? ''
      : `<div class="margin-rating" style="background: ${rating.color};"></div><div class="badge-rating" style="background: ${rating.color}; color: white" title="${escapeHtml(rating.label)}"><i class="${rating.icon}"></i></div>`,
  ].join('');
  const caption =
    status === 'finished'
      ? shownDate === null
        ? ''
        : formatDate(shownDate)
      : (STATUS_LABELS[status] ?? '');
  return `<div class="media-card" data-title="${escapeHtml(entry.title.toLowerCase())}" data-year="${year}" data-type="${type}" data-status="${status}" data-rating="${entry.rating ?? ''}" data-genres="${pipe(entry.genres)}" data-tags="${pipe(entry.tags)}" data-platforms="${pipe(entry.platforms)}"><div class="media-poster"><a href="${href}"><img src="${escapeHtml(coverSrc(entry.cover, handle, 'thumb'))}" alt="${escapeHtml(entry.title)}" loading="lazy" width="300" height="450"></a>${badges}</div><div class="media-info"><h3><a href="${href}">${escapeHtml(entry.title)}</a></h3><small>${escapeHtml(caption)}</small></div></div>`;
}
