import type { AlertKind } from '@metrack/domain';

/** The notification message for an alert kind. `date` is the release date. */
export function releaseAlertText(kind: AlertKind, date: string): string {
  switch (kind) {
    case 'releases_tomorrow':
      return `Releases tomorrow (${date})`;
    case 'releases_today':
      return `Releases today (${date})`;
    case 'available_es':
      return 'Now streaming in Spain on a subscription service';
  }
}
