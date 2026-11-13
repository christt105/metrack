/** What a Worker's `scheduled` handler is told about the cron trigger that fired. */
export interface ScheduledController {
  /** Milliseconds since the epoch of the moment the trigger was due. */
  scheduledTime: number;
  cron: string;
}
