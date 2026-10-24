import { describe, expect, it } from 'vitest';
import { convertBody } from '../src/convertBody.js';

const image = { ref: '/api/images/abc', hash: 'abc', extension: 'png', sourceUrl: null };

describe('convertBody', () => {
  const known = new Set(['Hollow Knight']);

  it('links known wikilinks and flattens unknown ones', () => {
    const { text } = convertBody(
      'See [[Media Tracker/Juegos/Hollow Knight|the game]] and [[Gone]] and [[Hollow Knight]].',
      known,
      new Map(),
    );
    expect(text).toBe(
      'See [the game]({{< ref "Hollow Knight" >}}) and Gone and [Hollow Knight]({{< ref "Hollow Knight" >}}).',
    );
  });

  it('leaves image embeds that could not be imported alone', () => {
    expect(convertBody('![[Missing.png]]', known, new Map()).text).toBe('![[Missing.png]]');
  });

  it('turns YouTube links into shortcodes', () => {
    expect(
      convertBody(
        'https://www.youtube.com/watch?v=abc-1 and https://youtu.be/xyz',
        known,
        new Map(),
      ).text,
    ).toBe('{{< youtube abc-1 >}} and {{< youtube xyz >}}');
  });

  it('points stored images at their bundle file and reports them', () => {
    const result = convertBody('![Shot](/api/images/abc)', known, new Map([[image.ref, image]]));
    expect(result.text).toBe('![Shot](abc.png)');
    expect(result.images).toEqual([image]);
  });
});
