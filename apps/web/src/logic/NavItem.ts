import type { AppIconName } from './AppIconName';

/** One entry of the main navigation. */
export interface NavItem {
  to: string;
  label: 'library' | 'search' | 'watchlist' | 'unlinked' | 'settings';
  icon: AppIconName;
  /** Route names under which this entry is the current page. */
  routes: readonly string[];
}
