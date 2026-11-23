import type { NavItem } from './NavItem';

/** The app's main sections, in the order the header and the phone tab bar show them. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'library', icon: 'library', routes: ['library', 'detail', 'new'] },
  { to: '/next', label: 'next', icon: 'next', routes: ['next'] },
  { to: '/search', label: 'search', icon: 'add', routes: ['search'] },
  { to: '/watchlist', label: 'watchlist', icon: 'following', routes: ['watchlist'] },
  { to: '/unlinked', label: 'unlinked', icon: 'inbox', routes: ['unlinked'] },
  { to: '/settings', label: 'settings', icon: 'settings', routes: ['settings'] },
];
