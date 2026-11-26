import { describe, expect, it } from 'vitest';
import { markdownText } from '../src/markdown/markdownText.js';
import { shortText } from '../src/shortText.js';

describe('markdownText', () => {
  it('keeps the words and drops the syntax', () => {
    const source = [
      '# Título',
      '',
      'Una **obra** con *cursiva*, _otra_, ~~nada~~ y `código`.',
      '> cita',
      '- [enlace](https://example.org) y [[Notas/Dune|Dune]]',
      '![foto](/api/images/x)',
      '---',
      '```',
      'bloque',
      '```',
    ].join('\n');
    expect(markdownText(source)).toBe(
      'Título Una obra con cursiva, otra, nada y código. cita enlace y Dune bloque',
    );
  });
});

describe('shortText', () => {
  it('cuts at a word with an ellipsis only when too long', () => {
    expect(shortText('corto', 10)).toBe('corto');
    expect(shortText('uno dos tres cuatro', 12)).toBe('uno dos…');
  });
});
