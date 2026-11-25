import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { formatDate } from './formatDate.js';
import { icon } from './icon.js';
import { coverSrc } from './imageOrDefault.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import { ratingClass, ratingTheme } from './ratingTheme.js';
import { entryPath } from './sitePaths.js';
import { TYPE_ICONS, themeType } from './themeType.js';
import { yearOf } from './yearOf.js';

const pipe = (values: string[]): string => escapeHtml(values.join('|').toLowerCase());

/**
 * A cover card. `date` is the day shown under a finished title, which for a rewatch is the rewatch's;
 * without one the release date is shown.
 */
export function renderCard(library: Library, entry: PublicEntry, date: string | null): string {
  const { handle, messages } = library;
  const href = escapeHtml(entryPath(handle, entry.kind, entry.id));
  const status = entryStatus(entry);
  const type = themeType(entry.kind);
  const shownDate = date ?? entry.releaseDate;
  const year = yearOf(date) ?? yearOf(entry.releaseDate) ?? '';
  const rated = status === 'finished' && entry.rating !== null;
  const rating = rated ? ratingTheme(entry.rating as number, messages) : null;
  const marks = [
    entry.allAchievements
      ? `<span class="card-mark card-trophy" title="${escapeHtml(messages.card.allAchievements)}">${icon('trophy', 14)}</span>`
      : '',
    entry.review !== null && entry.review.trim() !== ''
      ? `<span class="card-mark" title="${messages.card.hasReview}">${icon('review', 14)}</span>`
      : '',
  ].join('');
  const badges = [
    `<span class="card-type" title="${messages.typeLabels[type]}">${icon(TYPE_ICONS[type], 14)}</span>`,
    rating === null
      ? ''
      : `<span class="card-rating ${ratingClass(entry.rating)}" title="${escapeHtml(rating.label)}">${icon(rating.icon, 16)}</span>`,
    marks === '' ? '' : `<span class="card-marks">${marks}</span>`,
  ].join('');
  const caption =
    status === 'finished'
      ? shownDate === null
        ? ''
        : formatDate(shownDate, messages)
      : (messages.statusLabels[status] ?? '');
  return `<article class="card" data-title="${escapeHtml(entry.title.toLowerCase())}" data-year="${year}" data-type="${type}" data-status="${status}" data-rating="${entry.rating ?? ''}" data-genres="${pipe(entry.genres)}" data-tags="${pipe(entry.tags)}" data-platforms="${pipe(entry.platforms)}"><a class="card-link" href="${href}"><div class="card-poster"><img src="${escapeHtml(coverSrc(entry.cover, handle, 'thumb'))}" alt="" loading="lazy" decoding="async" width="300" height="450">${badges}</div><h3 class="card-title">${escapeHtml(entry.title)}</h3><p class="card-caption">${escapeHtml(caption)}</p></a></article>`;
}
