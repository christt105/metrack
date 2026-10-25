import { describe, expect, it, vi } from 'vitest';
import { NtfyNotifier } from '../src/notify/NtfyNotifier.js';

const logger = { info: vi.fn(), error: vi.fn() };

describe('NtfyNotifier', () => {
  it('posts the message to the topic with the bearer token', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 200 }));
    const notifier = new NtfyNotifier(
      { url: 'http://ntfy.local:8094/', topic: 'servidor', token: 'tk_secret' },
      logger,
      fetchFn as unknown as typeof fetch,
    );
    await notifier.notify('Title', 'Body');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ntfy.local:8094/servidor');
    expect(init.body).toBe('Body');
    expect(init.headers).toMatchObject({ Title: 'Title', Authorization: 'Bearer tk_secret' });
  });

  it('omits authorization without a token', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 200 }));
    await new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    ).notify('a', 'b');
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('sends priority, tags and the image attachment when given', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 200 }));
    await new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    ).notify('Lupin', 'Releases today', {
      priority: 'default',
      tags: ['calendar', 'tv'],
      imageUrl: 'https://image.tmdb.org/t/p/w500/p.jpg',
    });
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toMatchObject({
      Priority: 'default',
      Tags: 'calendar,tv',
      Attach: 'https://image.tmdb.org/t/p/w500/p.jpg',
    });
  });

  it('encodes titles that do not fit in an HTTP header', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 200 }));
    const notifier = new NtfyNotifier(
      { url: 'http://x', topic: 't' },
      logger,
      fetchFn as unknown as typeof fetch,
    );
    await notifier.notify('Ōkami, temporada 2', 'b');
    await notifier.notify('Café', 'b');
    const titles = fetchFn.mock.calls.map(
      (call) =>
        ((call as unknown as [string, RequestInit])[1].headers as Record<string, string>).Title,
    );
    expect(titles[0]).toBe(`=?UTF-8?B?${Buffer.from('Ōkami, temporada 2').toString('base64')}?=`);
    expect(titles[1]).toBe('Café');
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
