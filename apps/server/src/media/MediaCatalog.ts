import {
  COLLECTIONS,
  type Collection,
  type MediaPage,
  type MediaQuery,
  type MediaSortField,
  type MediaSummary,
  type Season,
} from '@metrack/domain';
import { fieldsOf } from './fieldsOf.js';
import type { MediaKind } from './MediaKind.js';
import { normalizeText } from './normalizeText.js';

const DEFAULT_LIMIT = 50;

function compare(a: MediaSummary, b: MediaSummary, field: MediaSortField): number {
  const x = a[field];
  const y = b[field];
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return String(x).localeCompare(String(y), undefined, { sensitivity: 'base' });
}

/** Filtered, searched and sorted listing across every collection. Titles are few, so it works in memory. */
export class MediaCatalog {
  constructor(
    private readonly kinds: Record<Collection, MediaKind>,
    private readonly seasonsOf: (seriesId: number) => Season[],
  ) {}

  list(query: MediaQuery): MediaPage {
    const needle = query.q ? normalizeText(query.q.trim()) : '';
    const matches: MediaSummary[] = [];
    for (const collection of COLLECTIONS) {
      const kind = this.kinds[collection];
      if (query.type && query.type !== kind.type) continue;
      for (const entity of kind.repository.list()) {
        const summary = kind.summarize(entity);
        if (query.status && !this.hasStatus(summary, query.status)) continue;
        if (needle && !this.matchesText(summary, entity, needle)) continue;
        matches.push(summary);
      }
    }

    const field = query.sort ?? 'title';
    const direction = query.order === 'desc' ? -1 : 1;
    matches.sort((a, b) => {
      const missingA = a[field] === null;
      const missingB = b[field] === null;
      if (missingA || missingB) return missingA === missingB ? 0 : missingA ? 1 : -1;
      return direction * compare(a, b, field) || a.id - b.id;
    });

    const offset = query.offset ?? 0;
    return {
      items: matches.slice(offset, offset + (query.limit ?? DEFAULT_LIMIT)),
      total: matches.length,
    };
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
