import {
  COLLECTIONS,
  type Collection,
  type MediaPage,
  type MediaQuery,
  type MediaSortField,
  type MediaSummary,
  type Season,
  type Tracking,
} from '@metrack/domain';
import type { Activity } from './Activity.js';
import { activityOf } from './activityOf.js';
import { fieldsOf } from './fieldsOf.js';
import type { MediaKind } from './MediaKind.js';
import { normalizeText } from './normalizeText.js';

const DEFAULT_LIMIT = 50;

function compare(
  a: MediaSummary,
  b: MediaSummary,
  field: Exclude<MediaSortField, 'recent'>,
): number {
  const x = a[field];
  const y = b[field];
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return String(x).localeCompare(String(y), undefined, { sensitivity: 'base' });
}

/**
 * Filtered, searched and sorted listing across every collection. Titles are few, so it works in memory.
 * The `recent` sort puts titles in progress first, then orders by the latest day each was started,
 * finished or rewatched (newest first unless `order=asc`); a series takes these from its seasons.
 */
export class MediaCatalog {
  constructor(
    private readonly kinds: Record<Collection, MediaKind>,
    private readonly seasonsOf: (seriesId: number) => Season[],
  ) {}

  list(query: MediaQuery): MediaPage {
    const needle = query.q ? normalizeText(query.q.trim()) : '';
    const matches: MediaSummary[] = [];
    const activity = new Map<MediaSummary, Activity>();
    for (const collection of COLLECTIONS) {
      const kind = this.kinds[collection];
      if (query.type && query.type !== kind.type) continue;
      for (const entity of kind.repository.list()) {
        const summary = kind.summarize(entity);
        if (query.status && !this.hasStatus(summary, query.status)) continue;
        if (needle && !this.matchesText(summary, entity, needle)) continue;
        matches.push(summary);
        if (query.sort === 'recent') activity.set(summary, this.activityOf(summary, entity));
      }
    }

    const field = query.sort ?? 'title';
    if (field === 'recent') {
      const direction = query.order === 'asc' ? 1 : -1;
      matches.sort((a, b) => {
        const x = activity.get(a) as Activity;
        const y = activity.get(b) as Activity;
        if (x.active !== y.active) return x.active ? -1 : 1;
        if (x.last === null || y.last === null) {
          if (x.last !== y.last) return x.last === null ? 1 : -1;
        } else if (x.last !== y.last) {
          return direction * (x.last < y.last ? -1 : 1);
        }
        return compare(a, b, 'title') || a.id - b.id;
      });
      return this.page(matches, query);
    }
    const direction = query.order === 'desc' ? -1 : 1;
    matches.sort((a, b) => {
      const missingA = a[field] === null;
      const missingB = b[field] === null;
      if (missingA || missingB) return missingA === missingB ? 0 : missingA ? 1 : -1;
      return direction * compare(a, b, field) || a.id - b.id;
    });

    return this.page(matches, query);
  }

  private page(matches: MediaSummary[], query: MediaQuery): MediaPage {
    const offset = query.offset ?? 0;
    return {
      items: matches.slice(offset, offset + (query.limit ?? DEFAULT_LIMIT)),
      total: matches.length,
    };
  }

  private activityOf(summary: MediaSummary, entity: { id: number }): Activity {
    if (summary.type === 'series') return activityOf(this.seasonsOf(summary.id));
    return activityOf([fieldsOf(entity) as Partial<Tracking>]);
  }

  private hasStatus(summary: MediaSummary, status: string): boolean {
    if (summary.type === 'series') {
      return this.seasonsOf(summary.id).some((season) => season.status === status);
    }
    return summary.status === status;
  }

  private matchesText(summary: MediaSummary, entity: { id: number }, needle: string): boolean {
    const original = fieldsOf(entity).originalTitle;
    const haystack = [
      summary.title,
      typeof original === 'string' ? original : '',
      summary.seriesTitle ?? '',
    ]
      .map(normalizeText)
      .join('\n');
    return haystack.includes(needle);
  }
}
