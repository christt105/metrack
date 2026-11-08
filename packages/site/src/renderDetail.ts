import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { findEntry } from './findEntry.js';
import { formatDate } from './formatDate.js';
import { imageSrc } from './imageSrc.js';
import { STATUS_LABELS, TYPE_LABELS } from './labels.js';
import type { Library } from './Library.js';
import { ownerName } from './ownerName.js';
import { platformIcon } from './platformIcon.js';
import type { PublicEntry } from './PublicEntry.js';
import type { PublicKind } from './PublicKind.js';
import { ratingTheme } from './ratingTheme.js';
import { renderCard } from './renderCard.js';
import { renderComments } from './renderComments.js';
import { renderLayout } from './renderLayout.js';
import { reviewHtml } from './reviewHtml.js';
import { homePath } from './sitePaths.js';
import { themeType } from './themeType.js';

function meta(entry: PublicEntry): string {
  const type = themeType(entry.kind);
  const status = entryStatus(entry);
  const parts = [`<span class="meta-item status-badge type-${type}">${TYPE_LABELS[type]}</span>`];
  if (entry.finishedAt !== null) {
    parts.push(
      `<span class="meta-item"><span class="icon">📅</span> ${escapeHtml(formatDate(entry.finishedAt))}</span>`,
    );
  }
  if (entry.developer !== null) {
    parts.push(
      `<span class="meta-item"><strong>Desarrollador:</strong> ${escapeHtml(entry.developer)}</span>`,
    );
  }
  if (entry.authors.length > 0) {
    parts.push(
      `<span class="meta-item"><strong>Autor:</strong> ${escapeHtml(entry.authors.join(', '))}</span>`,
    );
  }
  if (entry.kind !== 'series') {
    parts.push(
      `<span class="meta-item status-badge ${status}">${STATUS_LABELS[status] ?? status}</span>`,
    );
  }
  return `<div class="media-meta">${parts.join('')}</div>`;
}

function taxonomies(library: Library, entry: PublicEntry): string {
  const home = homePath(library.handle);
  const external =
    entry.externalUrl === null
      ? ''
      : `<a href="${escapeHtml(entry.externalUrl)}" target="_blank" rel="noopener noreferrer" class="external-link">${escapeHtml(entry.externalLabel ?? '')}</a>`;
  const platforms = entry.platforms.map(
    (name) =>
      `<a href="${escapeHtml(`${home}?platform=${encodeURIComponent(name.toLowerCase())}`)}" class="platform-badge"><i class="${platformIcon(name)}"></i> ${escapeHtml(name)}</a>`,
  );
  const tags = entry.tags.map(
    (tag) =>
      `<a href="${escapeHtml(`${home}?tag=${encodeURIComponent(tag.toLowerCase())}`)}" class="tag-link">#${escapeHtml(tag)}</a>`,
  );
  const groups = [
    platforms.length === 0
      ? ''
      : `<div class="taxonomy-group platforms-list">${platforms.join('')}</div>`,
    tags.length === 0 ? '' : `<div class="taxonomy-group tags-list">${tags.join('')}</div>`,
  ].join('');
  return `<div class="media-external-links">${external}</div><div class="media-taxonomies">${groups}</div>`;
}

function rewatches(entry: PublicEntry): string {
  if (entry.rewatches.length === 0) return '';
  const items = entry.rewatches.map((date) => `<li>${escapeHtml(formatDate(date))}</li>`).join('');
  return `<div class="media-rewatches"><strong>Rewatches:</strong><ul>${items}</ul></div>`;
}

function ratingBadge(entry: PublicEntry): string {
  if (entry.rating === null) return '';
  const theme = ratingTheme(entry.rating);
  return `<div class="media-rating-badge" style="background: ${theme.color}; color: white">${escapeHtml(theme.label)}</div>`;
}

function header(library: Library, entry: PublicEntry): string {
  const banner = imageSrc(entry.banner, library.handle, 'banner');
  const cover = imageSrc(entry.cover, library.handle, 'cover');
  const rated = entry.rating !== null;
  const title = escapeHtml(entry.title);
  const coverImage =
    cover === null ? '' : `<img src="${escapeHtml(cover)}" alt="${title}">${ratingBadge(entry)}`;
  const details = `<h1 class="header-title">${title}</h1>${meta(entry)}`;
  if (banner === null) {
    const simpleCover =
      cover === null
        ? ''
        : `<div class="media-simple-cover${rated ? ' has-rating' : ''}">${coverImage}</div>`;
    return `<header class="header media-simple-header">${simpleCover}<div class="media-simple-details">${details}${taxonomies(library, entry)}${rewatches(entry)}</div></header>`;
  }
  const bannerCover =
    cover === null
      ? ''
      : `<div class="media-cover${rated ? ' has-rating' : ''}">${coverImage}</div>`;
  return `<div class="media-header"><div class="banner-container"><img src="${escapeHtml(banner)}" class="media-banner-img" alt="Banner" loading="lazy"><div class="banner-gradient-mask"></div></div><div class="media-info-container">${bannerCover}<div class="media-details">${details}${taxonomies(library, entry)}${rewatches(entry)}</div></div></div>`;
}

function relations(library: Library, entry: PublicEntry): string {
  if (entry.kind === 'series') {
    const seasons = library.seasons.filter((season) => season.seriesId === entry.id);
    if (seasons.length === 0) return '';
    const cards = seasons
      .map((season) => renderCard(library.handle, season, season.finishedAt))
      .join('');
    return `<section class="media-relations"><h3 class="media-relations-title">Temporadas</h3><div class="media-grid media-grid-relations">${cards}</div></section>`;
  }
  if (entry.kind === 'season' && entry.seriesId !== null) {
    const series = findEntry(library, 'series', entry.seriesId);
    if (series) {
      return `<section class="media-relations"><h3 class="media-relations-title">Serie</h3><div class="media-grid-single">${renderCard(library.handle, series, series.finishedAt)}</div></section>`;
    }
  }
  return '';
}

/** The page of one item, or null when it is not shown. */
export function renderDetail(library: Library, kind: PublicKind, id: number): string | null {
  const entry = findEntry(library, kind, id);
  if (!entry) return null;
  const overview =
    entry.overview === null || entry.overview.trim() === '' ? null : escapeHtml(entry.overview);
  const synopsis =
    overview === null
      ? ''
      : `<details class="media-synopsis"><summary><i class="fas fa-chevron-right synopsis-caret" aria-hidden="true"></i> <span class="synopsis-label">Sinopsis</span> <span class="synopsis-preview">${overview}</span></summary><p class="synopsis-full">${overview}</p></details>`;
  const page = `<div class="wrapper post"><main class="page-content" aria-label="Content"><article>${header(library, entry)}${synopsis}<div class="page-content">${reviewHtml(library, entry)}</div>${relations(library, entry)}</article>${renderComments(library)}</main></div>`;
  return renderLayout({
    library,
    title: `${entry.title} | ${ownerName(library)}`,
    description: entry.overview ?? undefined,
    active: null,
    page,
  });
}
