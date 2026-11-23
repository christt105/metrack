import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { findEntry } from './findEntry.js';
import { formatDate } from './formatDate.js';
import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import type { SiteMessages } from './messages/SiteMessages.js';
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

function meta(messages: SiteMessages, entry: PublicEntry): string {
  const type = themeType(entry.kind);
  const status = entryStatus(entry);
  const parts = [
    `<span class="meta-item status-badge type-${type}">${messages.typeLabels[type]}</span>`,
  ];
  if (entry.finishedAt !== null) {
    parts.push(
      `<span class="meta-item"><span class="icon">📅</span> ${escapeHtml(formatDate(entry.finishedAt, messages))}</span>`,
    );
  }
  if (entry.developer !== null) {
    parts.push(
      `<span class="meta-item"><strong>${messages.detail.developer}</strong> ${escapeHtml(entry.developer)}</span>`,
    );
  }
  if (entry.authors.length > 0) {
    parts.push(
      `<span class="meta-item"><strong>${messages.detail.author}</strong> ${escapeHtml(entry.authors.join(', '))}</span>`,
    );
  }
  if (entry.kind !== 'series') {
    parts.push(
      `<span class="meta-item status-badge ${status}">${messages.statusLabels[status] ?? status}</span>`,
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

function abandoned(messages: SiteMessages, entry: PublicEntry): string {
  if (entry.abandoned.length === 0) return '';
  const items = entry.abandoned
    .map((pass) => {
      const started = pass.startedAt === null ? null : formatDate(pass.startedAt, messages);
      const finished = pass.finishedAt === null ? null : formatDate(pass.finishedAt, messages);
      const restarted = formatDate(pass.restartedOn, messages);
      return `<li>${escapeHtml(messages.detail.abandonedPass(started, finished, restarted))}</li>`;
    })
    .join('');
  return `<div class="media-rewatches"><strong>${messages.detail.abandoned}</strong><ul>${items}</ul></div>`;
}

function rewatches(messages: SiteMessages, entry: PublicEntry): string {
  const started = abandoned(messages, entry);
  if (entry.rewatches.length === 0) return started;
  const items = entry.rewatches
    .map((date) => `<li>${escapeHtml(formatDate(date, messages))}</li>`)
    .join('');
  return `<div class="media-rewatches"><strong>${messages.detail.rewatches}</strong><ul>${items}</ul></div>${started}`;
}

function ratingBadge(messages: SiteMessages, entry: PublicEntry): string {
  if (entry.rating === null) return '';
  const theme = ratingTheme(entry.rating, messages);
  return `<div class="media-rating-badge" style="background: ${theme.color}; color: white">${escapeHtml(theme.label)}</div>`;
}

function header(library: Library, entry: PublicEntry): string {
  const { messages } = library;
  const banner = imageSrc(entry.banner, library.handle, 'banner');
  const cover = imageSrc(entry.cover, library.handle, 'cover');
  const rated = entry.rating !== null;
  const title = escapeHtml(entry.title);
  const coverImage =
    cover === null
      ? ''
      : `<img src="${escapeHtml(cover)}" alt="${title}">${ratingBadge(messages, entry)}`;
  const details = `<h1 class="header-title">${title}</h1>${meta(messages, entry)}`;
  if (banner === null) {
    const simpleCover =
      cover === null
        ? ''
        : `<div class="media-simple-cover${rated ? ' has-rating' : ''}">${coverImage}</div>`;
    return `<header class="header media-simple-header">${simpleCover}<div class="media-simple-details">${details}${taxonomies(library, entry)}${rewatches(messages, entry)}</div></header>`;
  }
  const bannerCover =
    cover === null
      ? ''
      : `<div class="media-cover${rated ? ' has-rating' : ''}">${coverImage}</div>`;
  return `<div class="media-header"><div class="banner-container"><img src="${escapeHtml(banner)}" class="media-banner-img" alt="${messages.detail.banner}" loading="lazy"><div class="banner-gradient-mask"></div></div><div class="media-info-container">${bannerCover}<div class="media-details">${details}${taxonomies(library, entry)}${rewatches(messages, entry)}</div></div></div>`;
}

function relations(library: Library, entry: PublicEntry): string {
  if (entry.kind === 'series') {
    const seasons = library.seasons.filter((season) => season.seriesId === entry.id);
    if (seasons.length === 0) return '';
    const cards = seasons.map((season) => renderCard(library, season, season.finishedAt)).join('');
    return `<section class="media-relations"><h3 class="media-relations-title">${library.messages.detail.seasons}</h3><div class="media-grid media-grid-relations">${cards}</div></section>`;
  }
  if (entry.kind === 'season' && entry.seriesId !== null) {
    const series = findEntry(library, 'series', entry.seriesId);
    if (series) {
      return `<section class="media-relations"><h3 class="media-relations-title">${library.messages.detail.series}</h3><div class="media-grid-single">${renderCard(library, series, series.finishedAt)}</div></section>`;
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
      : `<details class="media-synopsis"><summary><i class="fas fa-chevron-right synopsis-caret" aria-hidden="true"></i> <span class="synopsis-label">${library.messages.detail.synopsis}</span> <span class="synopsis-preview">${overview}</span></summary><p class="synopsis-full">${overview}</p></details>`;
  const page = `<div class="wrapper post"><main class="page-content" aria-label="${library.messages.contentLabel}"><article>${header(library, entry)}${synopsis}<div class="page-content">${reviewHtml(library, entry)}</div>${relations(library, entry)}</article>${renderComments(library)}</main></div>`;
  return renderLayout({
    library,
    title: `${entry.title} | ${ownerName(library)}`,
    description: entry.overview ?? undefined,
    active: 'home',
    page,
  });
}
