import { escapeHtml } from '@metrack/export';
import type { Library } from './Library.js';
import { aboutPath, collagePath, homePath, statsPath } from './sitePaths.js';

export type MenuPage = 'home' | 'collage' | 'stats' | 'about';

const HOME_ICON =
  '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-home"><title/><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

const MENU_ICON =
  '<svg width="25" height="25" stroke="currentColor" fill="none" viewBox="0 0 14 14"><title>Menu</title><path stroke-linecap="round" stroke-linejoin="round" d="M10.595 7H3.40726"/><path stroke-linecap="round" stroke-linejoin="round" d="M10.5096 3.51488H3.49301"/><path stroke-linecap="round" stroke-linejoin="round" d="M10.5096 10.4851H3.49301"/><path stroke-linecap="round" stroke-linejoin="round" d="M.5 12.5V1.5c0-.552285.447715-1 1-1h11C13.0523.5 13.5.947715 13.5 1.5v11C13.5 13.0523 13.0523 13.5 12.5 13.5H1.5C.947715 13.5.5 13.0523.5 12.5z"/></svg>';

function link(href: string, name: string, active: boolean, caret = false): string {
  const caretHtml = caret
    ? ' <i class="fas fa-chevron-down submenu-caret" aria-hidden="true"></i>'
    : '';
  return `<a class="menu-link${active ? ' active' : ''}" href="${escapeHtml(href)}">${escapeHtml(name)}${caretHtml}</a>`;
}

function libraryTypes(library: Library): { type: string; name: string }[] {
  return [
    { type: 'movie', name: 'Películas', shown: library.movies.length > 0 },
    { type: 'tv', name: 'Series', shown: library.series.length > 0 },
    { type: 'videogame', name: 'Juegos', shown: library.videogames.length > 0 },
    { type: 'book', name: 'Libros', shown: library.books.length > 0 },
  ].filter((entry) => entry.shown);
}

/** The navigation bar: the library with a dropdown per type, the collage, the statistics and, when the user wrote one, the about page. */
export function renderMenu(library: Library, active: MenuPage | null): string {
  const home = homePath(library.handle);
  const submenu = libraryTypes(library)
    .map((entry) => `<li>${link(`${home}?type=${entry.type}`, entry.name, false)}</li>`)
    .join('');
  const items = [
    `<li class="has-submenu">${link(home, 'Biblioteca', active === 'home', true)}${submenu === '' ? '' : `<ul class="submenu">${submenu}</ul>`}</li>`,
    `<li>${link(collagePath(library.handle), 'Collage', active === 'collage')}</li>`,
    `<li>${link(statsPath(library.handle), 'Estadísticas', active === 'stats')}</li>`,
    library.profile.about === null
      ? ''
      : `<li>${link(aboutPath(library.handle), 'Acerca de', active === 'about')}</li>`,
  ].join('');
  return `<div class="navbar" role="navigation"><nav class="menu" aria-label="Main Navigation"><a href="${escapeHtml(home)}" class="logo">${HOME_ICON}</a><input type="checkbox" id="menu-trigger" class="menu-trigger"><label for="menu-trigger"><span class="menu-icon">${MENU_ICON}</span></label><div class="trigger"><ul class="trigger-container">${items}</ul></div></nav></div>`;
}
