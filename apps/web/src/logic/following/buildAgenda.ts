import type { AgendaGroup } from './AgendaGroup';
import { daysBetween } from './dates';
import type { FollowingEvent } from './FollowingEvent';

/** How many days back a release still shows as just out. */
export const RECENT_DAYS = 7;

function groupOf(event: FollowingEvent, today: string): Omit<AgendaGroup, 'events'> | null {
  const days = daysBetween(today, event.date);
  if (days < -RECENT_DAYS) return null;
  if (days < 0) return { kind: 'recent', month: null };
  if (days === 0) return { kind: 'today', month: null };
  if (days === 1) return { kind: 'tomorrow', month: null };
  if (days < 7) return { kind: 'week', month: null };
  return { kind: 'month', month: event.date.slice(0, 7) };
}

/** Sorts dated releases into the agenda's groups, in order. Releases older than `RECENT_DAYS` are left out. */
export function buildAgenda(events: readonly FollowingEvent[], today: string): AgendaGroup[] {
  const groups: AgendaGroup[] = [];
  for (const event of events) {
    const group = groupOf(event, today);
    if (!group) continue;
    const last = groups[groups.length - 1];
    if (last && last.kind === group.kind && last.month === group.month) last.events.push(event);
    else groups.push({ ...group, events: [event] });
  }
  return groups;
}
