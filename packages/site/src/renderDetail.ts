import { escapeHtml } from '@metrack/export';
import { entryStatus } from './entryStatus.js';
import { findEntry } from './findEntry.js';
import { formatDate } from './formatDate.js';
import { formatInteger } from './formatInteger.js';
import { icon } from './icon.js';
import { imageSrc } from './imageSrc.js';
import type { Library } from './Library.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { ownerName } from './ownerName.js';
import { platformIcon } from './platformIcon.js';
import type { PublicEntry } from './PublicEntry.js';
import type { PublicKind } from './PublicKind.js';
import { ratingClass, ratingTheme } from './ratingTheme.js';
import { renderCard } from './renderCard.js';
import { renderComments } from './renderComments.js';
import { renderLayout } from './renderLayout.js';
import { reviewHtml } from './reviewHtml.js';
import { homePath } from './sitePaths.js';
import { TYPE_ICONS, themeType } from './themeType.js';

function facts(messages: SiteMessages, entry: PublicEntry): string {
  const type = themeType(entry.kind);
  const status = entryStatus(entry);
  const parts = [
    `<span class="pill">${icon(TYPE_ICONS[type], 16)} ${messages.typeLabels[type]}</span>`,
  ];
  if (entry.kind !== 'series') {
    parts.push(
      `<span class="pill status-${status}">${messages.statusLabels[status] ?? status}</span>`,
    );
  }
  if (entry.rating !== null) {
    const theme = ratingTheme(entry.rating, messages);
    parts.push(
      `<span class="pill pill-rating ${ratingClass(entry.rating)}">${icon(theme.icon, 16)} ${escapeHtml(theme.label)}</span>`,
    );
  }
  if (entry.finishedAt !== null) {
    parts.push(
      `<span class="pill">${icon('calendar', 16)} ${escapeHtml(formatDate(entry.finishedAt, messages))}</span>`,
    );
  }
  if (entry.allAchievements) {
    parts.push(
      `<span class="pill pill-trophy">${icon('trophy', 16)} ${escapeHtml(messages.card.allAchievements)}</span>`,
    );
  } else if (entry.achievements !== null) {
    parts.push(
      `<span class="pill">${icon('trophy', 16)} ${messages.detail.achievements} ${formatInteger(entry.achievements.unlocked, messages)} / ${formatInteger(entry.achievements.total, messages)}</span>`,
    );
  }
  return `<div class="pills">${parts.join('')}</div>`;
}

function credits(messages: SiteMessages, entry: PublicEntry): string {
  const lines = [
    entry.developer === null
      ? ''
      : `<div><dt>${messages.detail.developer}</dt><dd>${escapeHtml(entry.developer)}</dd></div>`,
    entry.authors.length === 0
      ? ''
      : `<div><dt>${messages.detail.author}</dt><dd>${escapeHtml(entry.authors.join(', '))}</dd></div>`,
    entry.rewatches.length === 0
      ? ''
      : `<div><dt>${messages.detail.rewatches}</dt><dd>${entry.rewatches.map((date) => escapeHtml(formatDate(date, messages))).join(', ')}</dd></div>`,
  ].join('');
  return lines === '' ? '' : `<dl class="detail-credits">${lines}</dl>`;
}

function links(library: Library, entry: PublicEntry): string {
  const home = homePath(library.handle);
  const external =
    entry.externalUrl === null
      ? ''
      : `<a href="${escapeHtml(entry.externalUrl)}" target="_blank" rel="noopener noreferrer" class="chip chip-link">${escapeHtml(entry.externalLabel ?? '')} ${icon('externalLink', 14)}</a>`;
  const platforms = entry.platforms.map(
    (name) =>
      `<a href="${escapeHtml(`${home}?platform=${encodeURIComponent(name.toLowerCase())}`)}" class="chip chip-link">${icon(platformIcon(name), 16)} ${escapeHtml(name)}</a>`,
  );
  const tags = entry.tags.map(
    (tag) =>
      `<a href="${escapeHtml(`${home}?tag=${encodeURIComponent(tag.toLowerCase())}`)}" class="chip chip-link">#${escapeHtml(tag)}</a>`,
  );
  const all = [external, ...platforms, ...tags].join('');
  return all === '' ? '' : `<div class="chips detail-links">${all}</div>`;
}

function header(library: Library, entry: PublicEntry): string {
  const { messages } = library;
  const banner = imageSrc(entry.banner, library.handle, 'banner');
  const cover = imageSrc(entry.cover, library.handle, 'cover');
  const backdrop =
    banner === null
      ? ''
      : `<div class="detail-backdrop"><img src="${escapeHtml(banner)}" alt="" fetchpriority="high"></div>`;
  const poster =
    cover === null
      ? ''
      : `<img class="detail-poster" src="${escapeHtml(cover)}" alt="" width="300" height="450">`;
  return `<header class="detail-hero${banner === null ? '' : ' has-backdrop'}">${backdrop}<div class="wrap detail-head${cover === null ? ' no-poster' : ''}">${poster}<div class="detail-headline"><h1 class="detail-title">${escapeHtml(entry.title)}</h1>${facts(messages, entry)}${credits(messages, entry)}${links(library, entry)}</div></div></header>`;
}

function relations(library: Library, entry: PublicEntry): string {
  if (entry.kind === 'series') {
    const seasons = library.seasons.filter((season) => season.seriesId === entry.id);
    if (seasons.length === 0) return '';
    const cards = seasons.map((season) => renderCard(library, season, season.finishedAt)).join('');
    return `<section class="detail-section"><h2 class="section-title">${library.messages.detail.seasons}</h2><div class="grid">${cards}</div></section>`;
  }
  if (entry.kind === 'season' && entry.seriesId !== null) {
    const series = findEntry(library, 'series', entry.seriesId);
    if (series) {
      return `<section class="detail-section"><h2 class="section-title">${library.messages.detail.series}</h2><div class="grid">${renderCard(library, series, series.finishedAt)}</div></section>`;
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
      : `<details class="synopsis"><summary><span class="synopsis-label">${library.messages.detail.synopsis}</span><span class="synopsis-preview">${overview}</span></summary><p>${overview}</p></details>`;
  const review = reviewHtml(library, entry);
  const body = `${synopsis}${review === '' ? '' : `<div class="prose review">${review}</div>`}${relations(library, entry)}${renderComments(library)}`;
  const page = `<main aria-label="${library.messages.contentLabel}"><article class="detail">${header(library, entry)}<div class="wrap detail-body">${body}</div></article></main>`;
  return renderLayout({
    library,
    title: `${entry.title} | ${ownerName(library)}`,
    description: entry.overview ?? undefined,
    active: 'home',
    page,
  });
}
