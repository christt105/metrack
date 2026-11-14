import type { Logger } from '../notify/Logger.js';
import type { Notifier } from '../notify/Notifier.js';
import type { ReleaseSource } from './ReleaseSource.js';
import type { ReleaseStore } from './ReleaseStore.js';

export interface ReleaseWatcherDeps {
  store: ReleaseStore;
  source: ReleaseSource;
  notifier: Notifier;
  logger: Logger;
  /** IANA time zone that decides what "today" and "tomorrow" mean. */
  timeZone: string;
  /** Nothing is checked or sent before this local hour, so alerts do not arrive at night. */
  notifyFromHour: number;
  now?: () => Date;
}
