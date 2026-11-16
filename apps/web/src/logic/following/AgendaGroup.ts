import type { FollowingEvent } from './FollowingEvent';

/** A run of the agenda: what just came out, today, tomorrow, the rest of the week, then one group per month. */
export interface AgendaGroup {
  kind: 'recent' | 'today' | 'tomorrow' | 'week' | 'month';
  /** `YYYY-MM`, only for `month`. */
  month: string | null;
  events: FollowingEvent[];
}
