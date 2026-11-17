import { describe, expect, it } from 'vitest';
import { countFormChanges } from '../src/logic/countFormChanges';
import { fieldSchemas } from '../src/logic/fieldSchemas';
import { toDraft } from '../src/logic/formDraft';
import type { FormState } from '../src/logic/countFormChanges';

const movie = {
  id: 4,
  tmdbId: 10,
  jellyfinId: null,
  title: 'Heat',
  originalTitle: null,
  releaseDate: null,
  overview: null,
  genres: ['Crime'],
  cast: [],
  director: null,
  status: 'completed',
  startedAt: null,
  finishedAt: null,
  rating: 5,
  review: null,
  pendingReview: false,
  note: null,
  slug: null,
  tags: [],
};

function state(over: Partial<FormState> = {}): FormState {
  const schemas = fieldSchemas.movies;
  return {
    schemas,
    entity: movie,
    draft: toDraft(schemas, movie),
    status: 'completed',
    pendingReview: false,
    releases: [],
    ...over,
  };
}

describe('countFormChanges', () => {
  it('counts nothing for an untouched form', () => {
    expect(countFormChanges(state())).toBe(0);
  });

  it('counts each changed field once', () => {
    const base = state();
    const draft = { ...base.draft, title: 'Ronin', rating: '' };
    expect(countFormChanges({ ...base, draft })).toBe(2);
  });

  it('counts a field typed back to its original value as unchanged', () => {
    const base = state();
    expect(countFormChanges({ ...base, draft: { ...base.draft, title: 'Heat' } })).toBe(0);
  });

  it('counts status, pending review and releases', () => {
    expect(
      countFormChanges(state({ status: 'in_progress', pendingReview: true, releases: ['title'] })),
    ).toBe(3);
  });

  it('does not throw on input buildPatch rejects', () => {
    const base = state();
    const draft = { ...base.draft, tmdbId: 'abc', title: '' };
    expect(countFormChanges({ ...base, draft })).toBe(2);
  });

  it('ignores status and pending review on an entity without them', () => {
    const series = { id: 1, tmdbId: null, title: 'X', genres: [], cast: [], tags: [] };
    const schemas = fieldSchemas.series;
    expect(
      countFormChanges({
        schemas,
        entity: series,
        draft: toDraft(schemas, series),
        status: 'planned',
        pendingReview: true,
        releases: [],
      }),
    ).toBe(0);
  });
});
