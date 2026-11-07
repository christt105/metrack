import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/markdown/renderMarkdown.js';
import { HASH_A } from './support.js';

const context = {
  handle: 'ana',
  origin: '',
  linkFor: (name: string) => (name === 'Dune' ? '/u/ana/movie/3' : null),
};

describe('renderMarkdown', () => {
  it('escapes raw HTML', () => {
    const html = renderMarkdown('<script>alert(1)</script> & "x"', context);
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>');
  });

  it('renders paragraphs, headings, lists, quotes and rules', () => {
    const html = renderMarkdown(
      '# Título\n\nUna **fuerte** y *suave*.\n\n- a\n- b\n\n1. uno\n\n> cita\n\n---',
      context,
    );
    expect(html).toContain('<h2>Título</h2>');
    expect(html).toContain('<p>Una <strong>fuerte</strong> y <em>suave</em>.</p>');
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(html).toContain('<ol><li>uno</li></ol>');
    expect(html).toContain('<blockquote><p>cita</p></blockquote>');
    expect(html).toContain('<hr>');
  });

  it('only links http, https and mailto addresses', () => {
    expect(renderMarkdown('[a](https://example.com/x?a=1&b=2)', context)).toBe(
      '<p><a href="https://example.com/x?a=1&amp;b=2" rel="noopener noreferrer">a</a></p>',
    );
    expect(renderMarkdown('[a](javascript:alert)', context)).toBe('<p>a</p>');
  });

  it('points stored images at the public image address and drops unknown ones', () => {
    expect(renderMarkdown(`![foto](/api/images/${HASH_A})`, context)).toBe(
      `<p><img src="/u/ana/images/${HASH_A}" alt="foto" loading="lazy"></p>`,
    );
    expect(renderMarkdown('![x](file:///etc/passwd)', context)).toBe('<p>x</p>');
    expect(renderMarkdown('![x](/api/images/short)', context)).toBe('<p>x</p>');
  });

  it('resolves wikilinks to known pages and keeps the text of the rest', () => {
    expect(renderMarkdown('Ver [[Dune]] y [[Otra|esa]]', context)).toBe(
      '<p>Ver <a href="/u/ana/movie/3">Dune</a> y esa</p>',
    );
  });

  it('keeps code literal', () => {
    expect(renderMarkdown('`*a*` y\n```\n<b>\n```', context)).toBe(
      '<p><code>*a*</code> y</p>\n<pre><code>&lt;b&gt;</code></pre>',
    );
  });
});
