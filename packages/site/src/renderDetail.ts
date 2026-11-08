import { escapeHtml, statusKey } from '@metrack/export';
import { findEntry } from './findEntry.js';
import { formatDate } from './formatDate.js';
import { imageSrc } from './imageSrc.js';
import { KIND_LABELS, STATUS_LABELS } from './labels.js';
import type { Library } from './Library.js';
import type { PublicEntry } from './PublicEntry.js';
import type { PublicKind } from './PublicKind.js';
import { ratingTheme } from './ratingTheme.js';
import { renderCard } from './renderCard.js';
import { renderLayout } from './renderLayout.js';
import { reviewHtml } from './reviewHtml.js';

function badges(entry: PublicEntry): string {
  const key = statusKey(entry.status);
  const parts = [
    `<span class="meta-item status-badge type-${entry.kind}">${KIND_LABELS[entry.kind]}</span>`,
  ];
  if (entry.finishedAt !== null && key === 'finished') {
    parts.push(`<span class="meta-item">${escapeHtml(formatDate(entry.finishedAt))}</span>`);
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
    parts.push(`<span class="meta-item status-badge ${key}">${STATUS_LABELS[key]}</span>`);
  }
  if (entry.rating !== null && key === 'finished') {
    const theme = ratingTheme(entry.rating);
    parts.push(
      `<span class="meta-item status-badge" style="background: ${theme.color}">${entry.rating} · ${escapeHtml(theme.label)}</span>`,
    );
  }
  return parts.join('');
}

function taxonomies(entry: PublicEntry): string {
  const platforms = entry.platforms.map(
    (name) => `<span class="platform-badge">${escapeHtml(name)}</span>`,
  );
  const tags = entry.tags.map((tag) => `<span class="tag-link">#${escapeHtml(tag)}</span>`);
  const external =
    entry.externalUrl === null
      ? ''
      : `<a class="external-link" href="${escapeHtml(entry.externalUrl)}" rel="noopener noreferrer">${escapeHtml(entry.externalLabel ?? '')}</a>`;
  return [
    external === '' ? '' : `<div class="media-external-links">${external}</div>`,
    platforms.length === 0 ? '' : `<div class="taxonomy-group">${platforms.join('')}</div>`,
    tags.length === 0 ? '' : `<div class="taxonomy-group">${tags.join('')}</div>`,
  ].join('');
}

function rewatches(entry: PublicEntry): string {
  if (entry.rewatches.length === 0) return '';
  const items = entry.rewatches.map((date) => `<li>${escapeHtml(formatDate(date))}</li>`).join('');
  return `<div class="media-rewatches"><strong>Revisionados:</strong><ul>${items}</ul></div>`;
}

function header(library: Library, entry: PublicEntry): string {
  const banner = imageSrc(entry.banner, library.handle, 'banner');
  const cover = imageSrc(entry.cover, library.handle, 'cover');
  const rated = entry.rating !== null && statusKey(entry.status) === 'finished';
  const coverHtml =
    cover === null
      ? ''
      : `<div class="media-cover${rated ? ' has-rating' : ''}"><img src="${escapeHtml(cover)}" alt="${escapeHtml(entry.title)}"></div>`;
  const details = `<div class="media-details"><h1 class="header-title">${escapeHtml(entry.title)}</h1><div class="media-meta">${badges(entry)}</div>${taxonomies(entry)}${rewatches(entry)}</div>`;
  if (banner === null) return `<header class="media-simple-header">${coverHtml}${details}</header>`;
  return `<div class="media-header"><div class="banner-container"><img src="${escapeHtml(banner)}" class="media-banner-img" alt=""><div class="banner-gradient-mask"></div></div><div class="media-info-container">${coverHtml}${details}</div></div>`;
}

function relations(library: Library, entry: PublicEntry): string {
  if (entry.kind === 'series') {
    const seasons = library.seasons.filter((season) => season.seriesId === entry.id);
    if (seasons.length === 0) return '';
    const cards = seasons
      .map((season) => renderCard(library.handle, season, season.finishedAt))
      .join('');
    return `<section class="media-relations"><h3 class="media-relations-title">Temporadas</h3><div class="media-grid">${cards}</div></section>`;
  }
  if (entry.kind === 'season' && entry.seriesId !== null) {
    const series = findEntry(library, 'series', entry.seriesId);
    if (series) {
      return `<section class="media-relations"><h3 class="media-relations-title">Serie</h3><div class="media-grid media-grid-single">${renderCard(library.handle, series, null)}</div></section>`;
    }
  }
  return '';
}

/** The page of one item, or null when it is not shown. */
export function renderDetail(library: Library, kind: PublicKind, id: number): string | null {
  const entry = findEntry(library, kind, id);
  if (!entry) return null;
  const synopsis =
    entry.overview === null || entry.overview.trim() === ''
      ? ''
      : `<details class="media-synopsis"><summary><span class="synopsis-label">Sinopsis</span></summary><p class="synopsis-full">${escapeHtml(entry.overview)}</p></details>`;
  const review = reviewHtml(library, entry);
  const body = `<main aria-label="Contenido"><article>${header(library, entry)}${synopsis}${review === '' ? '' : `<div class="page-content review">${review}</div>`}${relations(library, entry)}</article></main>`;
  return renderLayout({
    title: `${entry.title} · @${library.handle}`,
    handle: library.handle,
    body,
  });
}
