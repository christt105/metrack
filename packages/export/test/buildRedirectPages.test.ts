import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildRedirectPages } from '../src/buildRedirectPages.js';

const [notFound, index] = buildRedirectPages({ newOrigin: 'https://media.example.com/' });

function run(html: string, location: { pathname: string; search: string; hash: string }) {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
  const calls: string[] = [];
  const canonical = {
    href: '',
    setAttribute: (_name: string, value: string) => (canonical.href = value),
  };
  runInNewContext(script, {
    location: { ...location, replace: (url: string) => calls.push(url) },
    document: { querySelector: () => canonical },
  });
  return { calls, canonical: canonical.href };
}

describe('buildRedirectPages', () => {
  it('produces the 404 and the root page with the same redirect', () => {
    expect(notFound!.path).toBe('404.html');
    expect(index!.path).toBe('index.html');
    expect(notFound!.content).toBe(index!.content);
  });

  it('carries a meta refresh and a canonical link to the new root', () => {
    expect(notFound!.content).toContain(
      '<meta http-equiv="refresh" content="0; url=https://media.example.com/">',
    );
    expect(notFound!.content).toContain('<link rel="canonical" href="https://media.example.com/">');
  });

  it('keeps the path, query and hash of an old address', () => {
    const result = run(notFound!.content, {
      pathname: '/MediaTracker/tv/Vinland%20Saga%20(2019)/',
      search: '?type=tv',
      hash: '#top',
    });
    expect(result.calls).toEqual([
      'https://media.example.com/tv/Vinland%20Saga%20(2019)/?type=tv#top',
    ]);
    expect(result.canonical).toBe('https://media.example.com/tv/Vinland%20Saga%20(2019)/');
  });

  it('sends the old root to the new root', () => {
    expect(run(index!.content, { pathname: '/MediaTracker/', search: '', hash: '' }).calls).toEqual(
      ['https://media.example.com/'],
    );
    expect(run(index!.content, { pathname: '/MediaTracker', search: '', hash: '' }).calls).toEqual([
      'https://media.example.com/',
    ]);
  });

  it('does not strip a path that only starts with the same letters', () => {
    expect(
      run(index!.content, { pathname: '/MediaTrackerX/a', search: '', hash: '' }).calls,
    ).toEqual(['https://media.example.com/MediaTrackerX/a']);
  });

  it('honors another old base path', () => {
    const [custom] = buildRedirectPages({ newOrigin: 'https://x.test', oldBasePath: '/old/' });
    expect(run(custom!.content, { pathname: '/old/a/', search: '', hash: '' }).calls).toEqual([
      'https://x.test/a/',
    ]);
  });

  it('rejects an origin that is not a bare http(s) address', () => {
    expect(() => buildRedirectPages({ newOrigin: 'media.example.com' })).toThrow();
    expect(() => buildRedirectPages({ newOrigin: 'https://x.test/path' })).toThrow();
  });

  it('cannot be broken out of by a hostile origin', () => {
    expect(() =>
      buildRedirectPages({ newOrigin: 'https://x.test"></script><script>alert(1)' }),
    ).toThrow();
  });
});
