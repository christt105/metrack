import {
  normalizeViewings,
  readAbandoned,
  readViewings,
  type AbandonedPass,
  type MediaStatus,
  type Tracking,
  type Viewing,
} from '@metrack/domain';
import type { Row } from './Row.js';
import type { RowValues } from './RowValues.js';

export function parseList(value: unknown): string[] {
  return JSON.parse(String(value)) as string[];
}

export function parseViewings(value: unknown): Viewing[] {
  return readViewings(JSON.parse(String(value)) as unknown[]);
}

export function parseAbandoned(value: unknown): AbandonedPass[] {
  return readAbandoned(JSON.parse(String(value)) as unknown[]);
}

export function text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function trackingFromRow(row: Row): Tracking {
  return {
    status: String(row.status) as MediaStatus,
    startedAt: text(row.started_at),
    finishedAt: text(row.finished_at),
    rating: num(row.rating),
    review: text(row.review),
    rewatches: parseViewings(row.rewatches),
    pendingReview: Number(row.pending_review) === 1,
  };
}

export function trackingToRow(tracking: Tracking): RowValues {
  return {
    status: tracking.status,
    started_at: tracking.startedAt,
    finished_at: tracking.finishedAt,
    rating: tracking.rating,
    review: tracking.review,
    rewatches: JSON.stringify(normalizeViewings(tracking.rewatches)),
    pending_review: tracking.pendingReview ? 1 : 0,
  };
}
