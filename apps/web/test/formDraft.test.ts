import { describe, expect, it } from 'vitest';
import { fieldSchemas } from '../src/logic/fieldSchemas';
import { buildPatch, DraftError, parseList, toDraft } from '../src/logic/formDraft';

const movie = {
  id: 1,
  tmdbId: 10,
  jellyfinId: null,
  title: 'Heat',
  originalTitle: null,
  releaseDate: '1995-12-15',
  overview: null,
  genres: ['Crime', 'Drama'],
  cast: [],
  director: null,
  follow: false,
  startedAt: null,
  finishedAt: null,
  rating: 8,
  review: null,
  note: null,
  slug: null,
  tags: [],
};
const schemas = fieldSchemas.movies;

describe('parseList', () => {
  it('trims, drops blanks and repeats', () => {
    expect(parseList(' a, b ,, a ,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('buildPatch', () => {
  it('is empty when nothing changed', () => {
    expect(buildPatch(schemas, movie, toDraft(schemas, movie))).toEqual({});
  });

  it('sends only the changed fields with typed values', () => {
    const draft = toDraft(schemas, movie);
    draft.rating = '9.5';
    draft.genres = 'Crime, Thriller';
    draft.tmdbId = '';
    draft.director = ' Michael Mann ';
    expect(buildPatch(schemas, movie, draft)).toEqual({
      rating: 9.5,
      genres: ['Crime', 'Thriller'],
      tmdbId: null,
      director: 'Michael Mann',
    });
  });

  it('rejects a blank required field', () => {
    const draft = toDraft(schemas, movie);
    draft.title = '  ';
    expect(() => buildPatch(schemas, movie, draft)).toThrow(DraftError);
  });

  it('rejects an out of range rating and a non integer id', () => {
    const draft = toDraft(schemas, movie);
    draft.rating = '11';
    expect(() => buildPatch(schemas, movie, draft)).toThrow(DraftError);
    draft.rating = '8';
    draft.tmdbId = '1.5';
    expect(() => buildPatch(schemas, movie, draft)).toThrow(DraftError);
  });
});
