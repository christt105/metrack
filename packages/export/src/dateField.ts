import { DateValue } from './renderFrontmatter.js';

/** A descriptive date as a bare YAML date, or null when it is not a full ISO date. */
export function dateField(date: string | null): DateValue | null {
  return date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new DateValue(date) : null;
}
