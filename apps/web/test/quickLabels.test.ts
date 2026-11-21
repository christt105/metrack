import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/messages/en';
import { es } from '../src/i18n/messages/es';

describe('quick action labels', () => {
  it('say watched, played or read depending on the collection, in both languages', () => {
    expect(es.quick.watchedToday.games).toBe('Jugado hoy');
    expect(es.quick.watchedToday.books).toBe('Leído hoy');
    expect(es.quick.watchedToday.movies).toBe('Visto hoy');
    expect(en.quick.watchedToday.games).toBe('Played today');
    expect(en.quick.watchedToday.books).toBe('Read today');
    expect(en.quick.watchedDone.series).toBe('Marked as watched today');
    expect(es.quick.watchedDone.games).toBe('Marcado como jugado hoy');
  });
});
