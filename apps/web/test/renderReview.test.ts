import { describe, expect, it } from 'vitest';
import { renderReview } from '../src/logic/renderReview';

const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('renderReview', () => {
  it('draws a stored image from the private image route', () => {
    expect(renderReview(`![Hall](/api/images/${hash})`)).toBe(
      `<p><img src="/api/images/${hash}" alt="Hall" loading="lazy"></p>`,
    );
  });

  it('keeps linked web images and drops other references', () => {
    expect(renderReview('![x](https://example.com/a.png)')).toContain('<img src="https://');
    expect(renderReview('![x](javascript:void)')).toBe('<p>x</p>');
  });

  it('turns headings into headings below the title', () => {
    expect(renderReview('## 2019-01-30')).toBe('<h3>2019-01-30</h3>');
  });

  it('shows a wikilink as its plain name without brackets', () => {
    expect(renderReview('See [[Diario Zelda Wind Waker]] now')).toBe(
      '<p>See Diario Zelda Wind Waker now</p>',
    );
    expect(renderReview('[[Notes/Diario.md|the diary]]')).toBe('<p>the diary</p>');
    expect(renderReview('[[Notes/Diario.md]]')).not.toContain('<a');
  });

  it('escapes raw HTML and never leaves a script or handler behind', () => {
    const html = renderReview(
      '<script>alert(1)</script> <img src=x onerror=alert(2)> [a](javascript:alert(3)) ![<b>](/x" onerror="y)',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/<img[^>]*onerror/);
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('&lt;script&gt;');
  });
});
