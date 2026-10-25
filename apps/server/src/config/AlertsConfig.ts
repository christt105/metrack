export interface AlertsConfig {
  enabled: boolean;
  /** IANA time zone that decides what "today" and "tomorrow" mean. */
  timeZone: string;
  /** Local hour before which nothing is checked or sent. */
  notifyFromHour: number;
}
