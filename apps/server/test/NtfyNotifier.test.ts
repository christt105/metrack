import { describe, expect, it, vi } from 'vitest';
import { NtfyNotifier } from '../src/notify/NtfyNotifier.js';

const logger = { info: vi.fn(), error: vi.fn() };

function okFetch() {
  return vi.fn(async () => new Response('', { status: 200 }));
}

function request(fetchFn: ReturnType<typeof okFetch>, index = 0) {
  const [url, init] = fetchFn.mock.calls[index] as unknown as [string, RequestInit];
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string) as Record<string, unknown>,
  };
}

describe('NtfyNotifier', () => {
  it('publishes JSON to the server root with the topic and the bearer token', async () => {
    const fetchFn = okFetch();
    const notifier = new NtfyNotifier(
      { url: 'http://ntfy.local:8094/', topic: 'servidor', token: 'tk_secret' },
      logger,
      fetchFn as unknown as typeof fetch,
    );
    await notifier.notify('Title', 'Body');
    const sent = request(fetchFn);
    expect(sent.url).toBe('http://ntfy.local:8094/');
    expect(sent.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tk_secret',
    });
    expect(sent.body).toEqual({
      topic: 'servidor',
      title: 'Title',
      message: 'Body',
      priority: 4,
      tags: ['warning'],
    });
  });

  it('omits authorization without a token', async () => {
    const fetchFn = okFetch();
    await new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    ).notify('a', 'b');
    const sent = request(fetchFn);
    expect(sent.url).toBe('http://x/');
    expect(sent.headers).not.toHaveProperty('Authorization');
  });

  it('sends priority, tags and the image attachment when given', async () => {
    const fetchFn = okFetch();
    await new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    ).notify('Lupin', 'Releases today', {
      priority: 'default',
      tags: ['calendar', 'tv'],
      imageUrl: 'https://image.tmdb.org/t/p/w500/p.jpg',
    });
    expect(request(fetchFn).body).toMatchObject({
      priority: 3,
      tags: ['calendar', 'tv'],
      attach: 'https://image.tmdb.org/t/p/w500/p.jpg',
    });
  });

  it('keeps accented and non-Latin text intact and out of the headers', async () => {
    const fetchFn = okFetch();
    const notifier = new NtfyNotifier(
      { url: 'http://x', topic: 't', token: 'tk' },
      logger,
      fetchFn as unknown as typeof fetch,
    );
    await notifier.notify('Café, temporada 2', 'Se estrena mañana', { tags: ['película'] });
    await notifier.notify('Ōkami, ñandú', 'b');
    expect(request(fetchFn, 0).body).toMatchObject({
      title: 'Café, temporada 2',
      message: 'Se estrena mañana',
      tags: ['película'],
    });
    expect(request(fetchFn, 1).body).toMatchObject({ title: 'Ōkami, ñandú' });
    for (const index of [0, 1]) {
      for (const value of Object.values(request(fetchFn, index).headers)) {
        expect(value).toMatch(/^[\x20-\x7e]*$/);
      }
    }
  });

  it('never turns line breaks in a title into extra headers', async () => {
    const fetchFn = okFetch();
    await new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    ).notify('Lupin\r\nPriority: 5', 'b');
    const sent = request(fetchFn);
    expect(sent.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(sent.body.title).toBe('Lupin\r\nPriority: 5');
  });

  it('logs instead of throwing when delivery fails', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('unreachable');
    });
    const notifier = new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    );
    await expect(notifier.notify('a', 'b')).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('unreachable'));
  });

  it('reports whether ntfy accepted the message', async () => {
    const statuses = [200, 503];
    const fetchFn = vi.fn(async () => new Response('', { status: statuses.shift() }));
    const notifier = new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    );
    await expect(notifier.notify('a', 'b')).resolves.toBe(true);
    await expect(notifier.notify('a', 'b')).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith('ntfy responded with status 503');
  });
});
