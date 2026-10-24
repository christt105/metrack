import type { MediaStatus } from '@metrack/domain';

const KEYS: Record<MediaStatus, string> = {
  planned: 'not_started',
  in_progress: 'in_progress',
  paused: 'paused',
  dropped: 'dropped',
  completed: 'finished',
};

/** The status name the site's data files use. */
export function statusKey(status: MediaStatus): string {
  return KEYS[status];
}
