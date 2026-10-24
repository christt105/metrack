import { describe, expect, it } from 'vitest';
import { DateValue, renderFrontmatter } from '../src/renderFrontmatter.js';

describe('renderFrontmatter', () => {
  it('sorts keys, drops empty values and writes dates bare', () => {
    const text = renderFrontmatter({
      title: 'A',
      rating: '7',
      date: new DateValue('2024-08-27'),
      tags: [],
      overview: null,
      rewatches: [new DateValue('2025-01-02')],
    });
    expect(text).toBe(
      '---\ndate: 2024-08-27\nrating: "7"\nrewatches:\n  - 2025-01-02\ntitle: A\n---\n',
    );
  });

  it('quotes values a YAML 1.1 reader would misread', () => {
    expect(renderFrontmatter({ title: 'Yes', other: 'a: b' })).toBe(
      '---\nother: "a: b"\ntitle: "Yes"\n---\n',
    );
  });

  it('writes multi-line text as a block', () => {
    expect(renderFrontmatter({ overview: 'one\ntwo' })).toBe(
      '---\noverview: |-\n  one\n  two\n---\n',
    );
  });

  it('rejects dates that are not ISO', () => {
    expect(() => new DateValue('Mar 2024')).toThrow();
  });
});
