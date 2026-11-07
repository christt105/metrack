import { escapeHtml, statusKey } from '@metrack/export';
import { KIND_LABELS, STATUS_LABELS } from './labels.js';
import { formatDate } from './formatDate.js';
import { imageSrc } from './imageSrc.js';
import type { PublicEntry } from './PublicEntry.js';
import { ratingTheme } from './ratingTheme.js';
import { entryPath } from './sitePaths.js';
import { yearOf } from './yearOf.js';

/** A cover card. `date` is the day shown under a finished title, which for a rewatch is the rewatch's. */
export function renderCard(handle: string, entry: PublicEntry, date: string | null): string {
  const href = escapeHtml(entryPath(handle, entry.kind, entry.id));
  const key = statusKey(entry.status);
  const cover = imageSrc(entry.cover, handle, 'thumb');
  const poster =
    cover === null
      ? `<span class="no-cover">${escapeHtml(entry.title.slice(0, 1).toUpperCase())}</span>`
      : `<img src="${escapeHtml(cover)}" alt="${escapeHtml(entry.title)}" loading="lazy">`;
  const rating =
    key === 'finished' && entry.rating !== null
      ? `<div class="margin-rating" style="background: ${ratingTheme(entry.rating).color}"></div><div class="badge-rating" style="background: ${ratingTheme(entry.rating).color}" title="${escapeHtml(ratingTheme(entry.rating).label)}">${entry.rating}</div>`
      : '';
  const review =
    entry.review !== null && entry.review.trim() !== ''
      ? '<div class="badge-content" title="Contiene reseña">R</div>'
      : '';
  const caption =
    key === 'finished'
      ? date === null
        ? (yearOf(entry.releaseDate) ?? '')
        : formatDate(date)
      : (STATUS_LABELS[key] ?? '');
  return `<div class="media-card"><div class="media-poster"><a href="${href}">${poster}</a><div class="badge-type ${entry.kind}" title="${escapeHtml(KIND_LABELS[entry.kind])}">${escapeHtml(KIND_LABELS[entry.kind])}</div>${review}${rating}</div><div class="media-info"><h3><a href="${href}">${escapeHtml(entry.title)}</a></h3><small>${escapeHtml(caption)}</small></div></div>`;
}
